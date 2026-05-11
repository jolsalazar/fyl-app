-- Pago mensual NO recurrente con Mercado Pago Checkout Pro.
-- Cada pago aprobado activa el plan por 30 días. El cobro siguiente lo inicia
-- el usuario manualmente; no hay autorización de cobro recurrente.

alter table public.profiles
  add column if not exists plan_expires_at timestamptz;

create table if not exists public.one_time_plan_payments (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade not null,
  plan           text not null check (plan in ('starter', 'advanced', 'agency')),
  mp_payment_id  text not null unique,
  status         text not null default 'approved',
  amount         integer not null,
  currency_id    text not null default 'CLP',
  paid_at        timestamptz not null,
  expires_at     timestamptz not null,
  created_at     timestamptz not null default now()
);

alter table public.one_time_plan_payments enable row level security;

create policy "Pagos propios select"
  on public.one_time_plan_payments for select
  using (auth.uid() = user_id);

create index if not exists one_time_plan_payments_user_created_idx
  on public.one_time_plan_payments (user_id, created_at desc);

create index if not exists profiles_plan_expiry_idx
  on public.profiles (plan_expires_at)
  where plan <> 'free' and plan_expires_at is not null;
