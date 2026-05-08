-- Configuración de pg_cron para los crons de suscripciones (NO se aplica
-- automáticamente — descomentar y configurar en producción).
--
-- Por qué está comentado:
-- 1. pg_cron + pg_net requieren extensiones que pueden no estar habilitadas
--    en todos los entornos (en local/CI suelen no estar).
-- 2. Las URLs y secretos cambian entre entornos.
-- 3. Si lo aplicáramos automáticamente en cada `supabase db push`, podríamos
--    sobreescribir jobs existentes o duplicarlos.
--
-- Para activar en producción:
-- 1. Habilitar extensiones desde Supabase Dashboard > Database > Extensions:
--    - pg_cron (debería estar disponible en Pro plan o superior)
--    - pg_net (para hacer HTTP desde SQL)
-- 2. Configurar Vault con los secretos:
--    select vault.create_secret('https://app.fondosylicitaciones.cl', 'app_url');
--    select vault.create_secret('<CRON_SECRET>', 'cron_secret');
-- 3. Ejecutar el bloque DESCOMENTADO de abajo en SQL Editor.
--
-- Alternativa: cron externo (GitHub Actions, Vercel Cron, Cloudflare Cron) que
-- haga POST a los endpoints con el header x-cron-secret. Ver docs/CRON.md.

/*
-- ── Setup pg_cron jobs ───────────────────────────────────────────────────

-- Aplicar cambio promo→regular: TODOS LOS DÍAS a las 03:00 UTC (00:00 Chile)
select cron.schedule(
  'aplicar-cambio-promo',
  '0 3 * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url') || '/api/cron/aplicar-cambio-promo',
    headers := jsonb_build_object(
      'Content-Type',   'application/json',
      'x-cron-secret',  (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body    := '{}'::jsonb
  ) as request_id;
  $$
);

-- Enviar aviso pre-cambio: TODOS LOS DÍAS a las 14:00 UTC (11:00 Chile)
-- (separado en horario diferente para distribuir carga)
select cron.schedule(
  'enviar-aviso-promo',
  '0 14 * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url') || '/api/cron/enviar-aviso-promo',
    headers := jsonb_build_object(
      'Content-Type',   'application/json',
      'x-cron-secret',  (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body    := '{}'::jsonb
  ) as request_id;
  $$
);

-- Para inspeccionar jobs:
-- select * from cron.job;
-- select * from cron.job_run_details order by start_time desc limit 20;

-- Para deshabilitar un job:
-- select cron.unschedule('aplicar-cambio-promo');
*/
