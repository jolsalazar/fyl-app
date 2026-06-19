-- Registro de envíos de los correos masivos (digest), para trocear el envío en
-- lotes a lo largo de una ventana de cron sin spamear: cada usuario se procesa una
-- sola vez por corrida. La clave de idempotencia es (digest_type, run_key, user_id);
-- registrar el mismo usuario dos veces es un no-op (insert con ignore-duplicates).
--
--   · digest_type: 'weekly' (resumen semanal free) | 'daily' (alert-digest diario)
--   · run_key:     fecha de la corrida en formato YYYY-MM-DD (UTC = fecha Chile
--                  dentro de la ventana 13:00–14:55 UTC en que corren los crons)
--
-- Los workers usan el service role (RLS no aplica); no se exponen políticas.

create table if not exists public.digest_sent_log (
  id          bigint generated always as identity primary key,
  digest_type text        not null,
  run_key     text        not null,
  user_id     uuid        not null,
  sent_at     timestamptz not null default now()
);

create unique index if not exists digest_sent_log_uniq
  on public.digest_sent_log (digest_type, run_key, user_id);

-- Para barrer "los ya enviados de esta corrida" rápido en cada tick.
create index if not exists digest_sent_log_run_idx
  on public.digest_sent_log (digest_type, run_key);
