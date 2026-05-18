-- Tabla de cobros reales recibidos vía MercadoPago.
-- Cada fila representa UN payment de MP (no una suscripción). Para suscripciones
-- recurrentes habrá una fila por cada cobro mensual; para pagos únicos (legacy
-- create-preference) habrá una sola fila.
--
-- Fuente de datos:
--   1. Webhook (type='payment') que inserta en tiempo real con fee_details
--      y net_received_amount reales que devuelve MP.
--   2. Backfill desde /v1/payments/search para histórico previo a la
--      instrumentación. Idempotente vía UNIQUE en mp_payment_id.
--
-- Esta tabla alimenta el dashboard de finanzas admin (MRR, cobros del mes,
-- por liberar). El monto NETO es la fuente de verdad — fee_amount y
-- taxes_amount son derivados de fee_details[].

create table public.payments (
  id                    uuid primary key default gen_random_uuid(),
  mp_payment_id         text not null unique,                  -- ID en MercadoPago (canónico)
  mp_preapproval_id     text,                                   -- null si es pago único
  user_id               uuid references auth.users(id) on delete set null,

  -- Montos en CLP. MP devuelve enteros (sin decimales para CLP).
  transaction_amount    integer not null,                       -- bruto cobrado
  fee_amount            integer not null default 0,             -- comisión MP (base, sin IVA)
  taxes_amount          integer not null default 0,             -- IVA sobre la comisión
  net_received_amount   integer not null,                       -- lo que MP nos transfiere

  status                text not null,                          -- approved | pending | rejected | refunded | charged_back
  status_detail         text,
  external_reference    text,                                   -- formato "user_id:plan" si aplica

  date_approved         timestamptz,                            -- cuándo MP aprobó el pago
  money_release_date    timestamptz,                            -- cuándo MP libera el dinero al vendedor

  created_at            timestamptz default now() not null,
  updated_at            timestamptz default now() not null
);

create index payments_user_id_idx           on public.payments (user_id);
create index payments_preapproval_id_idx    on public.payments (mp_preapproval_id) where mp_preapproval_id is not null;
create index payments_date_approved_idx     on public.payments (date_approved desc) where date_approved is not null;
create index payments_money_release_idx     on public.payments (money_release_date) where money_release_date is not null;
create index payments_status_idx            on public.payments (status);

-- updated_at automático
create or replace function public.set_payments_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_payments_updated_at();

-- RLS: no expuesto a clientes regulares. Solo admins leen vía RPC security definer.
-- Escritura solo desde service_role (webhook, backfill endpoint).
alter table public.payments enable row level security;

-- (sin policies para anon/authenticated)
