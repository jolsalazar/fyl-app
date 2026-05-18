-- Registro de transiciones de plan por usuario.
-- Alimenta el dashboard de finanzas admin (movimiento MRR: nuevo/expansión/contracción/churn).
-- Una fila por cada cambio efectivo de profiles.plan.
--
-- Se popula automáticamente desde public.admin_set_user_plan, que es la ÚNICA
-- ruta autorizada para mutar profiles.plan (RLS bloquea cambios directos del
-- usuario — ver migración 20260507000050_lock_role_plan.sql).
--
-- mrr_delta se calcula con el precio REGULAR de cada plan (no promo). Esto da
-- el "MRR comprometido" — el ingreso normalizado una vez que la promo termine.

create table public.plan_changes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade not null,
  from_plan     text not null check (from_plan in ('free', 'starter', 'advanced', 'agency')),
  to_plan       text not null check (to_plan   in ('free', 'starter', 'advanced', 'agency')),
  mrr_delta     integer not null,                      -- positivo=upgrade, negativo=downgrade
  occurred_at   timestamptz not null default now(),
  source        text not null check (source in (
                  'webhook',            -- cobro automático MP
                  'cancel',             -- usuario canceló desde la UI
                  'admin',              -- admin cambió plan manualmente
                  'create_preapproval', -- upgrade/downgrade desde checkout
                  'system_init'         -- baseline al instalar esta migración
                ))
);

create index plan_changes_user_idx      on public.plan_changes (user_id);
create index plan_changes_occurred_idx  on public.plan_changes (occurred_at desc);
create index plan_changes_source_idx    on public.plan_changes (source);

-- RLS: no expuesto a clientes regulares. Solo admins leen vía RPC security definer.
alter table public.plan_changes enable row level security;
-- (sin policies para anon/authenticated)


-- ── admin_set_user_plan extendida con `source` y registro automático ─────────
-- Mantenemos la firma vieja (target_id, new_plan) con DEFAULT 'admin' para
-- backward compat con cualquier llamada existente sin source. Las llamadas
-- nuevas desde TS deben pasar source explícito para trazabilidad.
--
-- Si new_plan == old_plan: no-op (no inserta plan_change ni updatea profiles).
create or replace function public.admin_set_user_plan(
  target_id uuid,
  new_plan  text,
  source    text default 'admin'
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_old_plan  text;
  v_old_price integer;
  v_new_price integer;
begin
  -- service_role pasa auth.uid() = null. Admin pasa su uuid y debe tener role='admin'.
  if auth.uid() is not null
     and (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Not authorized';
  end if;

  if new_plan not in ('free', 'starter', 'advanced', 'agency') then
    raise exception 'Invalid plan';
  end if;

  if source not in ('webhook', 'cancel', 'admin', 'create_preapproval', 'system_init') then
    raise exception 'Invalid source: %', source;
  end if;

  select plan into v_old_plan from public.profiles where id = target_id;
  if v_old_plan is null then
    raise exception 'Profile not found: %', target_id;
  end if;

  -- No-op si no cambia nada. Evita registros espurios en plan_changes.
  if v_old_plan = new_plan then
    return;
  end if;

  -- Precios regulares (post-promo). Mantener sincronizado con utils/planes.ts.
  v_old_price := case v_old_plan
    when 'starter'  then 8990
    when 'advanced' then 29990
    when 'agency'   then 59990
    else 0
  end;
  v_new_price := case new_plan
    when 'starter'  then 8990
    when 'advanced' then 29990
    when 'agency'   then 59990
    else 0
  end;

  update public.profiles set plan = new_plan where id = target_id;

  insert into public.plan_changes (user_id, from_plan, to_plan, mrr_delta, source)
  values (target_id, v_old_plan, new_plan, v_new_price - v_old_price, source);
end;
$$;

-- La firma cambió (agregamos 3er parámetro con default). Los grants previos sobre
-- la firma vieja (target_id uuid, new_plan text) ya no aplican — re-grant explícito.
revoke execute on function public.admin_set_user_plan(uuid, text, text) from anon, authenticated;
grant  execute on function public.admin_set_user_plan(uuid, text, text) to   service_role;


-- ── Seed inicial de plan_changes ─────────────────────────────────────────────
-- Para todos los users que ya están en un plan pagado, registramos un cambio
-- 'free' → su plan actual con occurred_at=created_at. Sin esto, los reportes
-- de churn/MRR no tienen baseline y arrancan en cero.
insert into public.plan_changes (user_id, from_plan, to_plan, mrr_delta, occurred_at, source)
select
  id,
  'free',
  plan,
  case plan
    when 'starter'  then 8990
    when 'advanced' then 29990
    when 'agency'   then 59990
    else 0
  end,
  created_at,
  'system_init'
from public.profiles
where plan <> 'free';
