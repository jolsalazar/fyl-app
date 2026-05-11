# Suscripciones recurrentes — Deploy y testing

Guía operativa para activar pagos mensuales con MercadoPago.

## Decisión actual: pago mensual no recurrente

Desde mayo de 2026 el checkout principal usa **Checkout Pro pago único**:

- Endpoint frontend: `/api/mercadopago/create-preference`
- Webhook procesado: `payment`
- Efecto local: plan activo por 30 días en `profiles.plan_expires_at`
- Tabla de historial: `one_time_plan_payments`

El flujo recurrente con `/preapproval` queda documentado abajo como referencia,
pero no es el flujo activo del botón "Contratar".

Motivo: en pruebas reales con Mercado Pago Chile, el flujo de suscripciones
recurrentes tuvo demasiada fricción:

- El sandbox exige vendedor/comprador de prueba y no entrega consistentemente el
  email del comprador requerido por `payer_email`.
- `/preapproval` devolvió `500 Internal server error` con varios emails de
  prueba válidos o aparentemente válidos.
- Al mezclar comprador test con collector real devolvió `Both payer and collector must be real or test users`.
- Con credenciales productivas el checkout recurrente quedó bloqueado en la
  autorización de tarjeta, mostrando cargos temporales de validación ($950) y
  botón deshabilitado.

Próximo paso comercial recomendado: constituir/usar empresa y evaluar un PSP o
adquirente que soporte suscripción con RUT empresa y menor fricción. Mientras
tanto, vender mensualidades manuales renovables por Mercado Pago.

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

# Prueba controlada en producción (opcional, remover al terminar)
MP_TEST_AMOUNT=1000

# Cron (autenticación de endpoints /api/cron/*)
CRON_SECRET=<openssl rand -hex 32>

# Resend (emails de aviso/confirmación)
RESEND_API_KEY=<api key de Resend>      # ya existente para welcome email
```

`mpEnabled` (frontend) se deriva automáticamente de `MP_ACCESS_TOKEN`. Si está
seteado, los botones de "Contratar" aparecen activos.

### Localhost / sandbox Mercado Pago para recurrente (referencia)

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
  - `payment` (flujo activo mensual no recurrente)
  - `preapproval` (referencia recurrente, no usado por el botón actual)
  - `subscription_authorized_payment` (referencia recurrente)
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
- `https://app.fondosylicitaciones.cl/api/cron/expirar-planes`       (05:00 UTC)

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

## 5. Smoke test pago mensual no recurrente

Para una prueba productiva controlada, setear temporalmente:

```bash
MP_TEST_AMOUNT=1000
```

Luego:

1. Iniciar sesión con un usuario real sin alias `+` en el email.
2. Ir a `/planes` → click "Contratar Starter".
3. Verificar redirect a Checkout Pro.
4. Pagar $1.000.
5. Volver a la app → debe mostrar `?pago=ok`.
6. Esperar webhook (~5-10s).
7. Verificar en BD:
   ```sql
   select plan, plan_expires_at from profiles where id = '<id>';
   select * from one_time_plan_payments where user_id = '<id>' order by created_at desc;
   ```
8. Remover `MP_TEST_AMOUNT` y redeploy antes de vender.

### Vencimiento manual

Para simular vencimiento:

```sql
update profiles
   set plan_expires_at = now() - interval '1 minute'
 where id = '<id>';
```

Luego llamar:

```bash
curl -X POST \
  -H "x-cron-secret: $CRON_SECRET" \
  https://app.fondosylicitaciones.cl/api/cron/expirar-planes
```

## 6. Troubleshooting

| Síntoma | Probable causa | Diagnóstico |
|---------|----------------|-------------|
| Webhook responde 401 `invalid_signature` | `MP_WEBHOOK_SECRET` mal configurado | Re-copiar del panel MP |
| `mercadopago_not_configured` | Falta env var | Verificar todas las MP_* y SUPABASE_* |
| Plan no se activa después de pagar | Webhook `payment` no llega | Revisar URL en panel MP, evento `payment` y firma |
| Cron 401 `unauthorized` | `CRON_SECRET` no coincide | Verificar header `x-cron-secret` |
| Plan pagado sigue activo después de vencer | Cron `expirar-planes` no corre | Revisar cron externo/pg_cron |
| Email no llega | `RESEND_API_KEY` faltante o dominio no verificado | Logs de Resend dashboard |

## 7. Monitoreo recomendado

- Revisar `cron.job_run_details` semanalmente (si pg_cron)
- Métricas: pagos mensuales, renovaciones, vencimientos, upgrades/downgrades manuales
