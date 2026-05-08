-- Tabla de idempotencia para webhooks. Antes de procesar cualquier evento de
-- MercadoPago, intentamos INSERT con ON CONFLICT DO NOTHING. Si el evento ya
-- estaba registrado, lo ignoramos.
--
-- Esto resuelve casos de retry/duplicación: MP puede reenviar el mismo webhook
-- por timeout, error de red o reintentos. Sin idempotencia explícita,
-- failed_payments podría incrementarse múltiples veces por el mismo cobro
-- rechazado, gatillando un downgrade prematuro.
--
-- Clave: (provider, event_type, event_id) — el event_id corresponde al data.id
-- del webhook (id del payment, preapproval, o authorized_payment según el tipo).
--
-- TTL: limpiar entries > 90 días via cron periódico (no implementado todavía;
-- la tabla puede crecer libremente y limpiarse cuando sea necesario).

create table public.webhook_events_processed (
  provider     text not null,
  event_type   text not null,
  event_id     text not null,
  processed_at timestamptz not null default now(),
  primary key (provider, event_type, event_id)
);

-- Solo service_role escribe acá. No hay policies de RLS para anon/authenticated:
-- esta tabla nunca se expone al frontend.
alter table public.webhook_events_processed enable row level security;

-- Índice por fecha para limpieza futura (cron de TTL)
create index webhook_events_processed_processed_at_idx
  on public.webhook_events_processed (processed_at);
