-- Bandeja de notificaciones de alertas
-- Registra cada oportunidad incluida en un email de alerta enviado al usuario
create table public.alert_notifications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  alert_config_id uuid not null references public.alert_configs(id) on delete cascade,
  convocatoria_id uuid not null,
  is_read         boolean not null default false,
  notified_at     timestamptz not null default now(),
  read_at         timestamptz,
  unique(alert_config_id, convocatoria_id)
);

alter table public.alert_notifications enable row level security;

create policy "Notificaciones propias"
  on public.alert_notifications for all
  using (auth.uid() = user_id);

-- Índice para consultas rápidas por alerta + estado de lectura
create index on public.alert_notifications(alert_config_id, is_read, notified_at desc);
-- Índice para limpieza por fecha
create index on public.alert_notifications(is_read, read_at);
