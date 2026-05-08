-- Agrega columna aviso_promo_enviado_at a subscriptions.
-- Se setea al enviar el email "tu promo termina en X días" (cron pre-cambio).
-- NULL = no enviado todavía. Se usa en el WHERE del cron para idempotencia
-- (no enviar el mismo aviso 2 veces aunque el cron corra varias veces).

alter table public.subscriptions
  add column if not exists aviso_promo_enviado_at timestamptz;

-- Índice parcial para el cron de aviso: solo busca suscripciones activas con
-- promo pendiente, sin aviso enviado, próximas a cumplir el plazo.
create index if not exists subscriptions_aviso_pendiente_idx
  on public.subscriptions (promo_ends_at)
  where promo_applied = false
    and aviso_promo_enviado_at is null
    and status = 'authorized';
