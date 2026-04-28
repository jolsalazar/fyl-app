-- Tracking de cuándo se envió la última notificación por alerta
alter table public.alert_configs
  add column if not exists last_notified_at timestamptz;
