-- El backfill importaba TODOS los pagos de la cuenta MP (sin filtro), incluyendo
-- cobros de otros proyectos del vendedor. Esos pagos quedaban con user_id null
-- y los RPCs de finanzas los sumaban igual (`p.id is null or not p.is_internal`),
-- inflando los cobros reales del dashboard.
--
-- Esta migración:
--   1. Borra los pagos ajenos ya importados (user_id null). Recuperables: el
--      backfill puede reimportar desde MP cualquier pago de fyl.
--   2. Endurece admin_finanzas_cobros y admin_finanzas_kpis: solo pagos con
--      user_id asociado (un pago de fyl siempre trae external_reference
--      "user_id:plan", del que se deriva user_id).
-- El backfill además ahora filtra por ese patrón antes de insertar.

-- ── 1. Limpieza de pagos ajenos ──────────────────────────────────────────────
delete from public.payments where user_id is null;

-- ── 2. admin_finanzas_cobros — solo pagos con user_id, excluye internos ──────
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

  -- CTE: payments aprobados de usuarios fyl NO-internos. Pagos sin user_id
  -- (no atribuibles a fyl) quedan fuera.
  return query
  with paid as (
    select pm.transaction_amount, pm.fee_amount, pm.taxes_amount,
           pm.net_received_amount, pm.date_approved
      from public.payments pm
      join public.profiles p on p.id = pm.user_id
     where pm.status = 'approved'
       and not coalesce(p.is_internal, false)
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

-- ── 3. admin_finanzas_kpis — por_liberar solo con pagos atribuidos ───────────
create or replace function public.admin_finanzas_kpis()
returns table (
  mrr_bruto         integer,
  mrr_neto          integer,
  mrr_comprometido  integer,
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
    join public.profiles p on p.id = pm.user_id
   where pm.money_release_date > now()
     and pm.status = 'approved'
     and not coalesce(p.is_internal, false);  -- sin user_id no cuenta

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
