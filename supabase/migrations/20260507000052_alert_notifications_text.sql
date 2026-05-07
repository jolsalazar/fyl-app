-- Unifica el tipo de convocatoria_id en text en todo el sistema.
-- En el resto del esquema (guardados, postulaciones, alert_matches, email_clicks)
-- convocatoria_id es text. La tabla alert_notifications quedó como uuid, lo que
-- causa errores de cast cuando los digests intentan upsertar `convocatorias.id` (text).

-- La unique key incluye convocatoria_id; hay que dropearla y recrearla.
alter table public.alert_notifications
  drop constraint if exists alert_notifications_alert_config_id_convocatoria_id_key;

alter table public.alert_notifications
  alter column convocatoria_id type text using convocatoria_id::text;

alter table public.alert_notifications
  add constraint alert_notifications_alert_config_id_convocatoria_id_key
  unique (alert_config_id, convocatoria_id);
