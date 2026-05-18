-- Preferencia de usuario: qué thresholds de cierre quiere recibir.
-- Default [3] mantiene el comportamiento que ya tenía la app antes de esta migración.
alter table public.profiles
  add column if not exists closing_reminder_days int[] not null default '{3}'::int[];

-- Extender control de dedupe: ahora un fondo puede dispararse en múltiples thresholds
-- (ej. usuario con [7, 3, 1] recibe 3 emails distintos para el mismo fondo, uno por threshold).
alter table public.closing_reminders_sent
  add column if not exists dias_anticipados int not null default 3;

alter table public.closing_reminders_sent
  drop constraint closing_reminders_sent_pkey;

alter table public.closing_reminders_sent
  add primary key (user_id, convocatoria_id, dias_anticipados);
