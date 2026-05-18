-- RPCs para el dashboard de finanzas admin. Todas son security definer y
-- solo ejecutables por usuarios con role='admin'. Devuelven agregaciones
-- sobre profiles, plan_changes y payments.
--
-- Convención de tarifa MP estimada: 3.2% base + 19% IVA = 3.808% efectivo.
-- Mantener sincronizado con utils/mp-fees.ts. Solo se usa para PROYECCIONES
-- (MRR neto futuro). Para cobros reales se usa fee_amount/taxes_amount/
-- net_received_amount de la tabla payments.

-- Helper interno: precio regular de un plan (sin promo). Mantener en sync con
-- utils/planes.ts. Si se cambia un precio en utils/planes.ts, también acá.
create or replace function public._plan_precio_regular(p text)
returns integer
language sql
immutable
as $$
  select case p
    when 'starter'  then 8990
    when 'advanced' then 29990
    when 'agency'   then 59990
    else 0
  end
$$;

-- Helper interno: chequea que el caller sea admin. Falla si no.
create or replace function public._assert_admin()
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if (select role from public.profiles where id = auth.uid()) <> 'admin' then
    raise exception 'Not authorized';
  end if;
end;
$$;
revoke execute on function public._assert_admin() from anon, authenticated;
grant  execute on function public._assert_admin() to   authenticated;


-- ── 1. KPIs principales ─────────────────────────────────────────────────────
-- Devuelve una sola fila con los números de cabecera del dashboard.
-- MRR usa precio REGULAR de cada plan (no promo) → "MRR comprometido normalizado".
-- fee_estimado = 3.808% (tarifa MP Chile efectiva).
-- por_liberar = sum(net_received_amount) de payments con money_release_date > now().
create or replace function public.admin_finanzas_kpis()
returns table (
  mrr_bruto       integer,
  mrr_neto        integer,
  arr_neto        integer,
  por_liberar     integer,
  clientes_pagos  integer,
  clientes_total  integer
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_mrr_bruto integer;
  v_mrr_neto  integer;
  v_por_lib   integer;
  v_pagos     integer;
  v_total     integer;
begin
  perform public._assert_admin();

  select coalesce(sum(public._plan_precio_regular(plan)), 0)
    into v_mrr_bruto
    from public.profiles
   where plan <> 'free';

  -- Fee efectivo MP Chile = 3.2% * 1.19 = 3.808%
  v_mrr_neto := round(v_mrr_bruto * (1 - 0.032 * 1.19));

  select coalesce(sum(net_received_amount), 0)
    into v_por_lib
    from public.payments
   where money_release_date > now()
     and status = 'approved';

  select count(*) into v_pagos from public.profiles where plan <> 'free';
  select count(*) into v_total from public.profiles;

  return query
  select v_mrr_bruto, v_mrr_neto, v_mrr_neto * 12, v_por_lib, v_pagos, v_total;
end;
$$;
revoke execute on function public.admin_finanzas_kpis() from anon, authenticated;
grant  execute on function public.admin_finanzas_kpis() to   authenticated;


-- ── 2. Movimientos de MRR del mes ──────────────────────────────────────────
-- Lista plan_changes del mes con email y clasificación de movimiento.
-- month_ref: cualquier fecha del mes a consultar (e.g., '2026-05-01').
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
  left join auth.users au on au.id = pc.user_id
  where pc.occurred_at >= date_trunc('month', month_ref)
    and pc.occurred_at <  date_trunc('month', month_ref) + interval '1 month'
    and pc.source <> 'system_init'  -- excluir baseline inicial
  order by pc.occurred_at desc;
end;
$$;
revoke execute on function public.admin_finanzas_movimientos(date) from anon, authenticated;
grant  execute on function public.admin_finanzas_movimientos(date) to   authenticated;


-- ── 3. Cobros reales del mes y mes anterior ─────────────────────────────────
-- Agrega sum/count desde payments para el mes solicitado y el anterior.
-- Solo status='approved' (no pending/rejected/refunded en el cálculo principal).
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

  return query
  select
    coalesce((select sum(transaction_amount)::integer  from public.payments
              where status='approved' and date_approved >= m_start and date_approved < m_end), 0),
    coalesce((select sum(fee_amount)::integer          from public.payments
              where status='approved' and date_approved >= m_start and date_approved < m_end), 0),
    coalesce((select sum(taxes_amount)::integer        from public.payments
              where status='approved' and date_approved >= m_start and date_approved < m_end), 0),
    coalesce((select sum(net_received_amount)::integer from public.payments
              where status='approved' and date_approved >= m_start and date_approved < m_end), 0),
    coalesce((select count(*)::integer                 from public.payments
              where status='approved' and date_approved >= m_start and date_approved < m_end), 0),
    coalesce((select sum(transaction_amount)::integer  from public.payments
              where status='approved' and date_approved >= p_start and date_approved < p_end), 0),
    coalesce((select sum(net_received_amount)::integer from public.payments
              where status='approved' and date_approved >= p_start and date_approved < p_end), 0),
    coalesce((select count(*)::integer                 from public.payments
              where status='approved' and date_approved >= p_start and date_approved < p_end), 0);
end;
$$;
revoke execute on function public.admin_finanzas_cobros(date) from anon, authenticated;
grant  execute on function public.admin_finanzas_cobros(date) to   authenticated;


-- ── 4. Desglose MRR por plan ───────────────────────────────────────────────
-- Tabla: plan / clientes / precio_regular / mrr_bruto / fee_estimado / mrr_neto.
create or replace function public.admin_finanzas_desglose_mrr()
returns table (
  plan            text,
  clientes        integer,
  precio_regular  integer,
  mrr_bruto       integer,
  fee_estimado    integer,
  mrr_neto        integer
)
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  perform public._assert_admin();

  return query
  select
    p.plan::text,
    count(*)::integer                                                as clientes,
    public._plan_precio_regular(p.plan)                              as precio_regular,
    (public._plan_precio_regular(p.plan) * count(*))::integer        as mrr_bruto,
    round(public._plan_precio_regular(p.plan) * count(*) * 0.032 * 1.19)::integer as fee_estimado,
    round(public._plan_precio_regular(p.plan) * count(*) * (1 - 0.032 * 1.19))::integer as mrr_neto
  from public.profiles p
  where p.plan in ('starter', 'advanced', 'agency')
  group by p.plan
  order by mrr_bruto desc;
end;
$$;
revoke execute on function public.admin_finanzas_desglose_mrr() from anon, authenticated;
grant  execute on function public.admin_finanzas_desglose_mrr() to   authenticated;


-- ── 5. Próximas liberaciones de MP ─────────────────────────────────────────
-- Lista pagos approved con money_release_date > now(). En Chile con liberación
-- inmediata esto debería estar siempre vacío; en cuentas con 14/30 días tiene
-- la queue de payouts pendientes.
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
  left join auth.users au on au.id = pm.user_id
  where pm.status = 'approved'
    and pm.money_release_date > now()
  order by pm.money_release_date asc;
end;
$$;
revoke execute on function public.admin_finanzas_por_liberar() from anon, authenticated;
grant  execute on function public.admin_finanzas_por_liberar() to   authenticated;
