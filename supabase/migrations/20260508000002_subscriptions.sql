-- Tabla de suscripciones recurrentes con MercadoPago.
-- Cada usuario puede tener UNA suscripción activa (status='authorized') a la vez.
-- Suscripciones canceladas/pausadas se mantienen para historial.
--
-- Flujo: el endpoint create-preapproval inserta con status='pending'. El webhook
-- de MP la marca 'authorized' cuando el usuario completa el checkout. Un cron
-- diario detecta promo_ends_at <= now() y hace PATCH a la preapproval en MP
-- para subir el monto a regular_amount (Fase 3).

create table public.subscriptions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid references auth.users(id) on delete cascade not null,
  plan                text not null check (plan in ('starter', 'advanced', 'agency')),

  mp_preapproval_id   text not null unique,                -- ID en MercadoPago

  status              text not null default 'pending'
                      check (status in ('pending', 'authorized', 'paused', 'cancelled')),

  current_amount      integer not null,                    -- monto que se cobra hoy
  regular_amount      integer not null,                    -- monto post-promo
  promo_applied       boolean not null default false,      -- true cuando se hizo PATCH
  promo_ends_at       timestamptz,                         -- null si no hay promo

  started_at          timestamptz,                         -- cuando MP autorizó
  cancelled_at        timestamptz,
  last_payment_at     timestamptz,                         -- último cobro exitoso
  failed_payments     integer not null default 0,          -- contador de fallos consecutivos

  created_at          timestamptz default now() not null,
  updated_at          timestamptz default now() not null
);

-- Índices
create index subscriptions_user_id_idx on public.subscriptions (user_id);
create index subscriptions_status_idx  on public.subscriptions (status);

-- Índice parcial para el cron de aplicar cambio promo→regular:
-- solo busca suscripciones activas que ya cumplieron promo y aún no se actualizaron.
create index subscriptions_promo_pending_idx
  on public.subscriptions (promo_ends_at)
  where promo_applied = false and status = 'authorized';

-- updated_at automático
create or replace function public.set_subscriptions_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_subscriptions_updated_at();

-- RLS: usuario lee solo su propia suscripción. Solo service_role puede escribir
-- (todas las modificaciones pasan por endpoints server-side y el webhook).
alter table public.subscriptions enable row level security;

create policy "Suscripción propia select"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- No hay policy para INSERT/UPDATE/DELETE desde anon/authenticated:
-- esas operaciones se hacen server-side con service_role.

-- Función helper: cancelar suscripción propia (RLS-aware).
-- El usuario llama este RPC desde el dashboard. La cancelación efectiva en MP
-- se procesa después en el endpoint /api/suscripcion/cancelar.
create or replace function public.cancelar_suscripcion_propia()
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.subscriptions
     set status = 'cancelled',
         cancelled_at = now()
   where user_id = auth.uid()
     and status = 'authorized'
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.cancelar_suscripcion_propia() from anon;
grant  execute on function public.cancelar_suscripcion_propia() to   authenticated;
