# Suscripciones recurrentes — Deploy y testing

Guía operativa para activar el flujo de pagos recurrentes con MercadoPago en local/sandbox y producción.

## 1. Variables de entorno requeridas

```bash
# MercadoPago
MP_ACCESS_TOKEN=<access token del vendedor — panel MP > Credenciales>
MP_WEBHOOK_SECRET=<secret del webhook — panel MP > Webhooks > Configurar>

# Supabase (server-side, NO la anon key)
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_KEY=<service role key>
SUPABASE_KEY=<anon/public key>          # ya existente, frontend

# App
APP_URL=https://app.fondosylicitaciones.cl

# Cron (autenticación de endpoints /api/cron/*)
CRON_SECRET=<openssl rand -hex 32>

# Resend (emails de aviso/confirmación)
RESEND_API_KEY=<api key de Resend>      # ya existente para welcome email
```

`mpEnabled` (frontend) se deriva automáticamente de `MP_ACCESS_TOKEN`. Si está
seteado, los botones de "Contratar" aparecen activos.

### Localhost / sandbox Mercado Pago

Para probar desde localhost, Mercado Pago igualmente necesita una URL pública
para llamar el webhook. Usar ngrok, Cloudflare Tunnel o equivalente y configurar:

```bash
APP_URL=https://<tunel-publico>
MP_ACCESS_TOKEN=<access token TEST del usuario de prueba vendedor>
MP_WEBHOOK_SECRET=<secret del webhook de la app del vendedor de prueba>
MP_TEST_PAYER_EMAIL=<email del comprador de prueba, opcional pero recomendado>
MP_SUBSCRIPTION_YEARS=2
MP_TEST_AMOUNT=1000 # opcional: override temporal, minimo CLP 950
```

En el panel de Mercado Pago, configurar el webhook de la aplicación sandbox con:

- **URL**: `https://<tunel-publico>/api/mercadopago/webhook`
- **Eventos**: `payment`, `preapproval`, `subscription_authorized_payment`

Para el checkout de prueba se usan dos cuentas de prueba:

- **Vendedor**: dueño de la aplicación y de las credenciales `TEST-*`.
- **Comprador**: usuario con el que se inicia sesión en Mercado Pago al pagar.
  Usar el campo `email` del usuario de prueba, no el `nickname`/usuario `TESTUSER...`.

No usar la misma cuenta como vendedor y comprador durante el flujo de sandbox.

## 2. Migraciones

Aplicar en orden vía `supabase db push` o ejecutando los SQL en orden:

1. `20260508000001_intended_plan.sql`         — columna `intended_plan` en profiles
2. `20260508000002_subscriptions.sql`         — tabla `subscriptions` + RPC cancelar
3. `20260508000003_aviso_promo.sql`           — columna `aviso_promo_enviado_at`
4. `20260508000004_pg_cron_setup.sql`         — instrucciones (NO ejecuta nada por defecto)
5. `20260508000005_subscriptions_uniq_active.sql` — unique partial index + columna `cancel_reason`. Incluye cleanup defensivo si hubiera duplicados pre-existentes
6. `20260508000006_webhook_events.sql`        — tabla `webhook_events_processed` para idempotencia

## 3. Webhook de MercadoPago

Panel MP → **Webhooks** → **Configurar**:

- **URL**: `https://app.fondosylicitaciones.cl/api/mercadopago/webhook`
- **Eventos a suscribir**:
  - `payment` (mantenido para compat con pagos únicos legacy)
  - `preapproval` (cambios de estado de la suscripción)
  - `subscription_authorized_payment` (cobros mensuales)
- Copiar el "secret" generado y guardarlo como `MP_WEBHOOK_SECRET`

## 4. Cron diario

Dos opciones — **una** es suficiente.

### A. pg_cron en Supabase (recomendada)

1. Database → Extensions → habilitar `pg_cron` y `pg_net`
2. SQL Editor:
   ```sql
   select vault.create_secret('https://app.fondosylicitaciones.cl', 'app_url');
   select vault.create_secret('<CRON_SECRET>', 'cron_secret');
   ```
3. Descomentar y ejecutar el bloque del archivo `20260508000004_pg_cron_setup.sql`
4. Verificar:
   ```sql
   select * from cron.job;                              -- jobs activos
   select * from cron.job_run_details order by start_time desc limit 10;
   ```

### B. Cron externo (alternativa)

GitHub Actions / Vercel Cron / Cloudflare Cron — POST diario a:

- `https://app.fondosylicitaciones.cl/api/cron/aplicar-cambio-promo` (03:00 UTC)
- `https://app.fondosylicitaciones.cl/api/cron/enviar-aviso-promo`   (14:00 UTC)

Header obligatorio: `x-cron-secret: <CRON_SECRET>`

Ejemplo GitHub Actions (`.github/workflows/cron-suscripciones.yml`):

```yaml
on:
  schedule:
    - cron: '0 3 * * *'    # aplicar cambio promo
    - cron: '0 14 * * *'   # enviar aviso
jobs:
  aplicar:
    if: github.event.schedule == '0 3 * * *'
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -fsS -X POST \
            -H "x-cron-secret: ${{ secrets.CRON_SECRET }}" \
            https://app.fondosylicitaciones.cl/api/cron/aplicar-cambio-promo
  aviso:
    if: github.event.schedule == '0 14 * * *'
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -fsS -X POST \
            -H "x-cron-secret: ${{ secrets.CRON_SECRET }}" \
            https://app.fondosylicitaciones.cl/api/cron/enviar-aviso-promo
```

## 5. Smoke test en sandbox MP

MP tiene cuentas de prueba para sandbox. Crear desde panel MP > "Cuentas de prueba".

### Test 1 — Happy path: contratar Starter
1. Iniciar sesión con un usuario de test
2. Ir a `/planes` → click "Contratar Starter"
3. Verificar redirect a checkout MP (sandbox)
4. Pagar con tarjeta de prueba (`4509 9535 6623 3704`, CVV 123, vencimiento futuro)
5. Volver a la app → debe mostrar `?sub=pending` y toast "Activando…"
6. Esperar webhook (~5-10s)
7. Verificar en `/dashboard/suscripcion`:
   - Status: Activa
   - Monto: $5.990
   - Promo válida hasta: +90 días
8. Verificar en BD:
   ```sql
   select * from subscriptions where user_id = '<id>';
   select plan from profiles where id = '<id>';  -- debe ser 'starter'
   ```

### Test 2 — Cancelación
1. En `/dashboard/suscripcion` → click "Cancelar suscripción"
2. Confirmar
3. Verificar:
   - Toast "Suscripción cancelada"
   - Status: Cancelada
   - Plan en profiles: `free`
   - En MP: la preapproval debe quedar en `cancelled`

### Test 3 — Cambio promo→regular (manual, simular)
1. UPDATE manual en BD para acelerar:
   ```sql
   update subscriptions
      set promo_ends_at = now() - interval '1 minute'
    where user_id = '<id>' and status = 'authorized';
   ```
2. Llamar manualmente al cron:
   ```bash
   curl -X POST \
     -H "x-cron-secret: $CRON_SECRET" \
     https://app.fondosylicitaciones.cl/api/cron/aplicar-cambio-promo
   ```
3. Verificar respuesta `{ ok: true, exitosos: 1 }`
4. Verificar:
   - `subscriptions.current_amount = regular_amount`
   - `subscriptions.promo_applied = true`
   - Email recibido con confirmación
   - En MP el `transaction_amount` cambió

### Test 4 — Aviso pre-cambio
1. UPDATE manual para que esté a 5 días del cambio:
   ```sql
   update subscriptions
      set promo_ends_at = now() + interval '5 days',
          aviso_promo_enviado_at = null
    where user_id = '<id>';
   ```
2. Llamar al cron:
   ```bash
   curl -X POST \
     -H "x-cron-secret: $CRON_SECRET" \
     https://app.fondosylicitaciones.cl/api/cron/enviar-aviso-promo
   ```
3. Verificar email recibido + `aviso_promo_enviado_at` actualizado

## 6. Troubleshooting

| Síntoma | Probable causa | Diagnóstico |
|---------|----------------|-------------|
| Webhook responde 401 `invalid_signature` | `MP_WEBHOOK_SECRET` mal configurado | Re-copiar del panel MP |
| `mercadopago_not_configured` | Falta env var | Verificar todas las MP_* y SUPABASE_* |
| Subscription queda en `pending` | Webhook no llega | Revisar URL en panel MP, eventos suscritos |
| Cron 401 `unauthorized` | `CRON_SECRET` no coincide | Verificar header `x-cron-secret` |
| PATCH MP devuelve 404 | preapproval_id inválido | Verificar que existe en panel MP |
| Email no llega | `RESEND_API_KEY` faltante o dominio no verificado | Logs de Resend dashboard |

## 7. Monitoreo recomendado

- Revisar `cron.job_run_details` semanalmente (si pg_cron)
- Alerta si `subscriptions.failed_payments >= 2` (cliente próximo a perder plan)
- Métricas: contratadas/mes, canceladas/mes, churn, downgrade por fallo
