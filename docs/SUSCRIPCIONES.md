# Suscripciones recurrentes — Deploy y testing

Guía operativa para activar el flujo recurrente mensual con Mercado Pago.

## 1. Variables de entorno requeridas

```bash
# Mercado Pago
MP_ACCESS_TOKEN=<access token del vendedor>
MP_WEBHOOK_SECRET=<secret del webhook>
MP_SUBSCRIPTION_YEARS=2

# Supabase
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_KEY=<service role key>
SUPABASE_KEY=<anon/public key>

# App
APP_URL=https://app.fondosylicitaciones.cl

# Cron
CRON_SECRET=<openssl rand -hex 32>

# Emails
RESEND_API_KEY=<api key de Resend>
```

No dejar variables temporales de pruebas en producción, especialmente
`MP_TEST_AMOUNT` o `MP_TEST_PAYER_EMAIL`.

## 2. Flujo activo

El botón "Contratar" usa:

- Frontend: `/api/mercadopago/create-preapproval`
- Mercado Pago: `/preapproval`
- Webhooks relevantes: `preapproval` y `subscription_authorized_payment`
- Estado local: tabla `subscriptions`

El endpoint crea una preapproval `pending`. Cuando el usuario autoriza el cobro
recurrente, Mercado Pago envía webhook `preapproval` con estado `authorized`; el
webhook marca la suscripción como activa y asigna el plan al usuario.

## 3. Migraciones

Aplicar en orden:

1. `20260508000001_intended_plan.sql`
2. `20260508000002_subscriptions.sql`
3. `20260508000003_aviso_promo.sql`
4. `20260508000004_pg_cron_setup.sql`
5. `20260508000005_subscriptions_uniq_active.sql`
6. `20260508000006_webhook_events.sql`

## 4. Webhook de Mercado Pago

Panel MP -> Webhooks -> Configurar:

- URL: `https://app.fondosylicitaciones.cl/api/mercadopago/webhook`
- Eventos:
  - `payment` (compatibilidad legacy)
  - `preapproval`
  - `subscription_authorized_payment`

Copiar la firma secreta del webhook a `MP_WEBHOOK_SECRET`.

## 5. Cron diario

Endpoints protegidos por header `x-cron-secret: <CRON_SECRET>`:

- `POST /api/cron/aplicar-cambio-promo`
- `POST /api/cron/enviar-aviso-promo`

`aplicar-cambio-promo` sube el monto desde precio promo a precio regular cuando
termina el periodo promocional. `enviar-aviso-promo` avisa antes del cambio.

## 6. Smoke test

1. Iniciar sesión con un usuario real de la app.
2. Ir a `/planes` y contratar Starter.
3. Verificar redirect a checkout de Mercado Pago.
4. Autorizar la suscripción.
5. Volver a `/dashboard`.
6. Esperar webhook.
7. Verificar:

```sql
select *
from subscriptions
where user_id = '<id>'
order by created_at desc;

select plan
from profiles
where id = '<id>';
```

La suscripción debe quedar `authorized` y el perfil debe tener el plan comprado.

## 7. Problemas detectados durante pruebas

Durante mayo de 2026 se probaron varias rutas sandbox/productivas. Hallazgos:

- El sandbox de MP Chile no siempre expone el email del comprador de prueba.
- `/preapproval` devolvió `500 Internal server error` para varios emails de
  prueba aparentemente válidos.
- Si el payer es test y el collector es real, MP responde:
  `Both payer and collector must be real or test users`.
- El checkout recurrente puede exigir autorización adicional de tarjeta y mostrar
  cargos temporales de validación.
- Emails con alias `+` pueden causar problemas con `payer_email`; conviene probar
  con el email real base del comprador.

Estos puntos son de operación/proveedor, no cambios de arquitectura local.

## 8. Troubleshooting

| Síntoma | Probable causa | Diagnóstico |
|---------|----------------|-------------|
| Webhook 401 `invalid_signature` | `MP_WEBHOOK_SECRET` incorrecto | Re-copiar secret del webhook correcto |
| `mercadopago_not_configured` | Falta env var | Revisar `MP_ACCESS_TOKEN`, `APP_URL`, `SUPABASE_*` |
| Preapproval queda `pending` | Webhook no llegó o usuario no autorizó | Revisar panel MP y logs |
| Checkout bloqueado | Cuenta/tarjeta requiere validación | Probar cuenta/tarjeta distinta o revisar MP |
| Cron 401 | `CRON_SECRET` incorrecto | Revisar header |
| Promo no cambia | Cron no corre o PATCH MP falla | Revisar logs del cron |
