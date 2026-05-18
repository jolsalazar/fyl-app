-- Tabla de control para evitar mandar el mismo recordatorio de cierre dos veces
-- al mismo usuario por la misma convocatoria. El worker de digest la usa cuando
-- arma la sección "Cierran pronto" del email diario.
--
-- Granularidad: un único recordatorio por (user, convocatoria) durante toda la
-- vida de la convocatoria. Si más adelante queremos mandar a 7 + 3 + 1 días,
-- se agrega una columna `dias_anticipados` al primary key.

create table public.closing_reminders_sent (
  user_id          uuid not null references auth.users(id) on delete cascade,
  convocatoria_id  text not null,
  sent_at          timestamptz not null default now(),
  primary key (user_id, convocatoria_id)
);

alter table public.closing_reminders_sent enable row level security;

-- Solo el usuario ve sus propios registros (aunque en la práctica solo escribe
-- el service_role desde el worker, los policies de SELECT permiten al usuario
-- inspeccionar el historial desde el cliente si más adelante hace falta).
create policy "Cierres propios"
  on public.closing_reminders_sent
  for all
  using (auth.uid() = user_id);

create index on public.closing_reminders_sent(user_id);
