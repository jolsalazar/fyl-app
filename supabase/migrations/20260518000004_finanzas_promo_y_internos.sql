-- Fix del modelo de finanzas tras feedback del 2026-05-18:
--   (1) MRR no debe derivarse del precio del plan en profiles. Un admin puede
--       mover a un usuario al plan starter sin que haya cobro real → no inflar
--       MRR. La fuente de verdad es subscriptions.current_amount (con promo
--       aplicada) y subscriptions.regular_amount (post-promo).
--   (2) Cuentas internas (jolsalazar, daniel vera) no son clientes — excluir
--       de todas las métricas (MRR, cobros, movimientos, desglose, por liberar).
--   (3) Movimientos con source='admin' no son eventos financieros — excluir
--       de la tabla de movimientos del mes.

-- ── 1. Columna is_internal en profiles ──────────────────────────────────────
alter table public.profiles
  add column if not exists is_internal boolean not null default false;

create index if not exists profiles_is_internal_idx
  on public.profiles (is_internal) where is_internal;

-- Marcar las cuentas internas conocidas al día de hoy.
update public.profiles
   set is_internal = true
 where id in (
   select id from auth.users
    where email in ('jolsalazar@gmail.com', 'danielveram@gmail.com')
 );

-- Limpieza: borrar las filas system_init de plan_changes para los internos
-- (no afecta nada — los RPCs ya los filtran — pero deja la tabla limpia).
delete from public.plan_changes
 where source  = 'system_init'
   and user_id in (select id from public.profiles where is_internal);


-- ── 2. RPC admin_finanzas_kpis — reescrita con fuente subscriptions ─────────
-- mrr_bruto       = SUM(current_amount) — lo que se está cobrando este mes
-- mrr_comprometido = SUM(regular_amount) — lo que se cobrará post-promo
-- Ambos filtran is_internal y status='authorized'.
--
-- DROP previo: la firma cambió respecto a la versión de la migración 3
-- (se agregó la columna mrr_comprometido). Postgres no permite cambiar el
-- RETURNS TABLE con CREATE OR REPLACE → hay que dropear primero.
drop function if exists public.admin_finanzas_kpis();
create or replace function public.admin_finanzas_kpis()
returns table (
  mrr_bruto         integer,
  mrr_neto          integer,
  mrr_comprometido  integer,   -- nuevo: MRR post-promo (run rate cuando todas las promos terminen)
  arr_neto          integer,
  por_liberar       integer,
  clientes_pagos    integer,
  clientes_total    integer
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_mrr_bruto    integer;
  v_mrr_comp     integer;
  v_mrr_neto     integer;
  v_por_lib      integer;
  v_pagos        integer;
  v_total        integer;
begin
  perform public._assert_admin();

  -- MRR actual: lo que estamos cobrando HOY (respeta promo activa).
  select coalesce(sum(s.current_amount), 0)::integer
    into v_mrr_bruto
    from public.subscriptions s
    join public.profiles p on p.id = s.user_id
   where s.status = 'authorized'
     and not p.is_internal;

  -- MRR comprometido: lo que cobraremos cuando todas las promos terminen.
  select coalesce(sum(s.regular_amount), 0)::integer
    into v_mrr_comp
    from public.subscriptions s
    join public.profiles p on p.id = s.user_id
   where s.status = 'authorized'
     and not p.is_internal;

  -- Fee efectivo MP Chile 3,2% × 1,19 = 3,808%.
  v_mrr_neto := round(v_mrr_bruto * (1 - 0.032 * 1.19))::integer;

  select coalesce(sum(pm.net_received_amount), 0)::integer
    into v_por_lib
    from public.payments pm
    left join public.profiles p on p.id = pm.user_id
   where pm.money_release_date > now()
     and pm.status = 'approved'
     and (p.id is null or not p.is_internal);  -- pagos sin user asociado se incluyen

  select count(distinct s.user_id)::integer
    into v_pagos
    from public.subscriptions s
    join public.profiles p on p.id = s.user_id
   where s.status = 'authorized'
     and not p.is_internal;

  select count(*)::integer
    into v_total
    from public.profiles
   where not is_internal;

  return query
  select v_mrr_bruto, v_mrr_neto, v_mrr_comp, v_mrr_neto * 12, v_por_lib, v_pagos, v_total;
end;
$$;
revoke execute on function public.admin_finanzas_kpis() from anon, authenticated;
grant  execute on function public.admin_finanzas_kpis() to   authenticated;


-- ── 3. RPC admin_finanzas_movimientos — excluye is_internal y source='admin' ─
create or replace function public.admin_finanzas_movimientos(month_ref date)
returns table (
  user_id        uuid,
  user_email     text,
  from_plan      text,
  to_plan        text,
  mrr_delta      integer,
  occurred_at    timestamptz,
  source         text,
  movement_type  text
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  perform public._assert_admin();

  return query
  select
    pc.user_id,
    au.email::text,
    pc.from_plan,
    pc.to_plan,
    pc.mrr_delta,
    pc.occurred_at,
    pc.source,
    case
      when pc.from_plan  = 'free' and pc.to_plan <> 'free' then 'new'
      when pc.from_plan <> 'free' and pc.to_plan  = 'free' then 'churn'
      when pc.from_plan <> 'free' and pc.to_plan <> 'free' and pc.mrr_delta > 0 then 'expansion'
      when pc.from_plan <> 'free' and pc.to_plan <> 'free' and pc.mrr_delta < 0 then 'contraction'
      else 'noop'
    end::text
  from public.plan_changes pc
  left join auth.users     au on au.id = pc.user_id
  left join public.profiles p on p.id  = pc.user_id
  where pc.occurred_at >= date_trunc('month', month_ref)
    and pc.occurred_at <  date_trunc('month', month_ref) + interval '1 month'
    and pc.source not in ('system_init', 'admin')  -- excluir baseline y overrides admin
    and (p.id is null or not p.is_internal)        -- excluir cuentas internas
  order by pc.occurred_at desc;
end;
$$;
revoke execute on function public.admin_finanzas_movimientos(date) from anon, authenticated;
grant  execute on function public.admin_finanzas_movimientos(date) to   authenticated;


-- ── 4. RPC admin_finanzas_cobros — excluye internos ────────────────────────
create or replace function public.admin_finanzas_cobros(month_ref date)
returns table (
  mes_bruto           integer,
  mes_fee             integer,
  mes_taxes           integer,
  mes_neto            integer,
  mes_count           integer,
  mes_anterior_bruto  integer,
  mes_anterior_neto   integer,
  mes_anterior_count  integer
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  m_start date := date_trunc('month', month_ref)::date;
  m_end   date := (date_trunc('month', month_ref) + interval '1 month')::date;
  p_start date := (date_trunc('month', month_ref) - interval '1 month')::date;
  p_end   date := m_start;
begin
  perform public._assert_admin();

  -- CTE: payments aprobados de NO-internos, anotados por bucket de mes.
  return query
  with paid as (
    select pm.transaction_amount, pm.fee_amount, pm.taxes_amount,
           pm.net_received_amount, pm.date_approved
      from public.payments pm
      left join public.profiles p on p.id = pm.user_id
     where pm.status = 'approved'
       and (p.id is null or not p.is_internal)
  )
  select
    coalesce((select sum(transaction_amount)::integer  from paid where date_approved >= m_start and date_approved < m_end), 0),
    coalesce((select sum(fee_amount)::integer          from paid where date_approved >= m_start and date_approved < m_end), 0),
    coalesce((select sum(taxes_amount)::integer        from paid where date_approved >= m_start and date_approved < m_end), 0),
    coalesce((select sum(net_received_amount)::integer from paid where date_approved >= m_start and date_approved < m_end), 0),
    coalesce((select count(*)::integer                 from paid where date_approved >= m_start and date_approved < m_end), 0),
    coalesce((select sum(transaction_amount)::integer  from paid where date_approved >= p_start and date_approved < p_end), 0),
    coalesce((select sum(net_received_amount)::integer from paid where date_approved >= p_start and date_approved < p_end), 0),
    coalesce((select count(*)::integer                 from paid where date_approved >= p_start and date_approved < p_end), 0);
end;
$$;
revoke execute on function public.admin_finanzas_cobros(date) from anon, authenticated;
grant  execute on function public.admin_finanzas_cobros(date) to   authenticated;


-- ── 5. RPC admin_finanzas_desglose_mrr — agrupa por subscriptions.plan ────
-- Cambio fundamental: la tabla la dictan las subscriptions authorized de
-- usuarios no-internos (no profiles.plan). Cada plan muestra:
--   clientes        = # suscripciones authorized en ese plan
--   precio_regular  = precio post-promo del plan
--   mrr_actual      = SUM(current_amount) — lo que cobramos hoy
--   mrr_comprometido = SUM(regular_amount) — lo que cobraremos post-promo
--   mrr_neto_actual = mrr_actual × (1 - fee)
--
-- DROP previo: las columnas cambiaron de nombre (mrr_bruto → mrr_actual,
-- agregamos mrr_comprometido, mrr_neto → mrr_neto_actual). Postgres no
-- permite ese cambio con CREATE OR REPLACE.
drop function if exists public.admin_finanzas_desglose_mrr();
create or replace function public.admin_finanzas_desglose_mrr()
returns table (
  plan              text,
  clientes          integer,
  precio_regular    integer,
  mrr_actual        integer,
  mrr_comprometido  integer,
  fee_estimado      integer,
  mrr_neto_actual   integer
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  perform public._assert_admin();

  return query
  select
    s.plan::text,
    count(*)::integer                                                  as clientes,
    max(s.regular_amount)::integer                                     as precio_regular,
    sum(s.current_amount)::integer                                     as mrr_actual,
    sum(s.regular_amount)::integer                                     as mrr_comprometido,
    round(sum(s.current_amount) * 0.032 * 1.19)::integer               as fee_estimado,
    round(sum(s.current_amount) * (1 - 0.032 * 1.19))::integer         as mrr_neto_actual
  from public.subscriptions s
  join public.profiles p on p.id = s.user_id
  where s.status = 'authorized'
    and not p.is_internal
  group by s.plan
  order by sum(s.current_amount) desc;
end;
$$;
revoke execute on function public.admin_finanzas_desglose_mrr() from anon, authenticated;
grant  execute on function public.admin_finanzas_desglose_mrr() to   authenticated;


-- ── 6. RPC admin_finanzas_por_liberar — excluye internos ───────────────────
create or replace function public.admin_finanzas_por_liberar()
returns table (
  mp_payment_id        text,
  user_email           text,
  transaction_amount   integer,
  net_received_amount  integer,
  money_release_date   timestamptz,
  date_approved        timestamptz
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  perform public._assert_admin();

  return query
  select
    pm.mp_payment_id,
    au.email::text,
    pm.transaction_amount,
    pm.net_received_amount,
    pm.money_release_date,
    pm.date_approved
  from public.payments pm
  left join auth.users     au on au.id = pm.user_id
  left join public.profiles p  on p.id  = pm.user_id
  where pm.status = 'approved'
    and pm.money_release_date > now()
    and (p.id is null or not p.is_internal)
  order by pm.money_release_date asc;
end;
$$;
revoke execute on function public.admin_finanzas_por_liberar() from anon, authenticated;
grant  execute on function public.admin_finanzas_por_liberar() to   authenticated;
