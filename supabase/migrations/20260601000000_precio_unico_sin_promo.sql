-- Cambio de estrategia: se elimina el aumento de precio a 90 días.
-- Starter y Advanced quedan a precio único y permanente ($5.990 / $19.990).
--
-- 1) Neutraliza las suscripciones que aún estaban en periodo promo para que el
--    cron de cambio promo→regular nunca las suba (regular = lo que pagan hoy).
-- 2) Redefine las funciones de finanzas/MRR con los precios nuevos.
--    Mantener sincronizado con utils/planes.ts.

-- ── 1. Suscripciones existentes en promo ────────────────────────────────────
update public.subscriptions
   set regular_amount = current_amount,  -- ya no se cobrará más que lo actual
       promo_applied  = true,            -- el cron de cambio promo→regular las ignora
       promo_ends_at  = null             -- limpia avisos/banner de "tu precio sube el …"
 where promo_applied = false
   and plan in ('starter', 'advanced');


-- ── 2. Precios regulares en funciones SQL (5990 / 19990) ─────────────────────

-- Helper central usado por los RPCs de finanzas (admin_finanzas_kpis / _desglose_mrr).
create or replace function public._plan_precio_regular(p text)
returns integer
language sql
immutable
as $$
  select case p
    when 'starter'  then 5990
    when 'advanced' then 19990
    when 'agency'   then 59990
    else 0
  end
$$;

-- admin_set_user_plan: misma firma y cuerpo que 20260518000002_plan_changes.sql,
-- solo se actualizan los precios usados para mrr_delta. Los grants persisten al
-- ser create-or-replace con firma idéntica.
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

  if v_old_plan = new_plan then
    return;
  end if;

  -- Precios únicos/permanentes. Mantener sincronizado con utils/planes.ts.
  v_old_price := case v_old_plan
    when 'starter'  then 5990
    when 'advanced' then 19990
    when 'agency'   then 59990
    else 0
  end;
  v_new_price := case new_plan
    when 'starter'  then 5990
    when 'advanced' then 19990
    when 'agency'   then 59990
    else 0
  end;

  update public.profiles set plan = new_plan where id = target_id;

  insert into public.plan_changes (user_id, from_plan, to_plan, mrr_delta, source)
  values (target_id, v_old_plan, new_plan, v_new_price - v_old_price, source);
end;
$$;


-- ── 3. Desactivar crons de promo (si pg_cron está activo en este entorno) ────
-- Los endpoints /api/cron/aplicar-cambio-promo y /api/cron/enviar-aviso-promo
-- fueron eliminados. Si en producción se agendaron vía pg_cron, los quitamos.
-- Inofensivo en entornos sin pg_cron o sin los jobs.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin perform cron.unschedule('aplicar-cambio-promo'); exception when others then null; end;
    begin perform cron.unschedule('enviar-aviso-promo');   exception when others then null; end;
  end if;
end $$;
