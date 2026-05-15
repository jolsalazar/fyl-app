# Estado integración Mercado Pago — suscripciones recurrentes

> Escrito el 2026-05-15. Punto de partida para retomar sin repetir todo desde cero.

---

## Contexto rápido

La app cobra suscripciones mensuales vía **preapprovals** de Mercado Pago (el producto de MP para cobros recurrentes). El flujo es:

1. Usuario elige plan en `/planes`
2. Frontend llama `POST /api/mercadopago/create-preapproval` → recibe `init_point`
3. Usuario es redirigido al checkout de MP, autoriza con su cuenta MP
4. MP envía webhook `type=preapproval, status=authorized` a `/api/mercadopago/webhook`
5. Webhook activa el plan en la BD (`profiles.plan`) y registra la suscripción en `subscriptions`

---

## Lo que arreglamos (ya funciona)

### 1. Creación del preapproval — era 500, ahora 200

**Causa:** el payload incluía `end_date` dentro de `auto_recurring`. MP Chile devuelve 500 silencioso cuando este campo está presente.

**Fix aplicado:** se eliminó `end_date` del payload en `server/api/mercadopago/create-preapproval.post.ts`. El preapproval ahora se crea sin fecha de fin (suscripción indefinida, el usuario la cancela cuando quiera).

### 2. Webhook — era 401, ahora 200

**Causa:** el `MP_WEBHOOK_SECRET` en Cloudflare no coincidía con el configurado en el panel de MP.

**Fix aplicado:** se actualizó la variable en Cloudflare con el valor correcto: `fb46b1adfbf048cef93b236e00f384f0f9ad77c87ebf0f8df4ff55e598170eb3`

### 3. Página `/dashboard/suscripcion` — quedaba en blanco

**Causa:** el template de `suscripcion.vue` tenía secciones para `authorized`, `paused` y `cancelled`, pero nada para `pending`. Después de crear el preapproval, la suscripción queda en `pending` hasta que el usuario autoriza en MP, y la página mostraba un blanco total.

**Fix aplicado:** se añadió una sección visible para `status === 'pending'` que informa al usuario que su suscripción está esperando autorización.

---

## Lo que NO funciona todavía

### El botón "Continuar" en el checkout de MP está deshabilitado

Este es el bloqueo actual. El usuario llega al checkout de MP, entra con el usuario test, selecciona tarjeta, pero el botón de pago nunca se habilita.

**Causa raíz entendida:**

MP Chile exige que **colector y pagador sean del mismo tipo**: ambos cuentas reales, o ambos cuentas test.

| Variable | Valor actual | Tipo |
|---|---|---|
| `MP_ACCESS_TOKEN` | `TEST-8153051865573184-...` de `jolsalazar@gmail.com` | **cuenta REAL en modo test** |
| `payer_email` | test_user_3270128415988500733@testuser.com | **cuenta TEST** |

MP rechaza la combinación. Error literal: `"Both payer and collector must be real or test users"`.

---

## Qué hay que hacer para cerrar la brecha

### Paso 1 — Obtener el `client_secret` de la app

Ir a `https://www.mercadopago.cl/developers/panel/app`, seleccionar la app **ID `8153051865573184`**, y copiar el **client secret** (está en la sección de credenciales).

### Paso 2 — Obtener el access token del test seller

Con el `client_secret` en mano, correr esto en la terminal del proyecto:

```bash
source .env && curl -s -X POST "https://api.mercadopago.com/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password&client_id=8153051865573184&client_secret=TU_CLIENT_SECRET&username=test_user_6866693117640302161%40testuser.com&password=5eCuClBRrc"
```

La respuesta incluye `access_token`. Ese es el token del **test seller**.

### Paso 3 — Actualizar variables en Cloudflare

| Variable en Cloudflare | Nuevo valor |
|---|---|
| `MP_ACCESS_TOKEN` | access token del test seller (del paso 2) |
| `MP_PAYER_EMAIL_OVERRIDE` | `test_user_3270128415988500733@testuser.com` |

### Paso 4 — Probar el flujo completo

1. Entrar a la app con cualquier cuenta
2. Ir a `/planes`, elegir Starter
3. En el checkout de MP, logarse con el **test buyer**:
   - Email: `test_user_3270128415988500733@testuser.com`
   - Contraseña: `iojeoqb1KV`
4. Seleccionar una tarjeta de prueba y completar el pago
5. Verificar que llega el webhook y el plan se activa en la BD

---

## Credenciales de test creadas (guardar esto)

> Estas cuentas fueron creadas con la API de MP el 2026-05-15. No hay forma de recuperar la contraseña si se pierde.

| Rol | Email | Contraseña | ID MP |
|---|---|---|---|
| Test seller | `test_user_6866693117640302161@testuser.com` | `5eCuClBRrc` | 3404634172 |
| Test buyer | `test_user_3270128415988500733@testuser.com` | `iojeoqb1KV` | 3404626176 |

---

## Advertencia de seguridad pendiente

El token de producción `APP_USR-8153051865573184-050714-e5e77f2f415aebf478b5cd8bde8f74bf-156179422` fue compartido en texto plano durante la sesión de trabajo. **Regenerar este token en el panel de MP antes de ir a producción.**

---

## Archivos relevantes

| Archivo | Qué hace |
|---|---|
| `server/api/mercadopago/create-preapproval.post.ts` | Crea el preapproval en MP e inserta en `subscriptions` |
| `server/api/mercadopago/webhook.post.ts` | Recibe eventos de MP, activa/cancela planes |
| `server/utils/mercadopago.ts` | Helpers: verificar firma, obtener preapproval, cancelar, etc. |
| `pages/dashboard/suscripcion.vue` | UI del estado de suscripción del usuario |
| `server/api/suscripcion/estado.get.ts` | API que devuelve la suscripción activa del usuario |
| `server/api/suscripcion/cancelar.post.ts` | Cancela la suscripción activa |
| `utils/planes.ts` | Configuración de planes (precios, features, promo) |

---

## Estado de Cloudflare (variables de entorno al día de hoy)

- `MP_ACCESS_TOKEN` → token TEST del usuario real `jolsalazar@gmail.com` (**debe cambiar al test seller**)
- `MP_WEBHOOK_SECRET` → `fb46b1adfbf048cef93b236e00f384f0f9ad77c87ebf0f8df4ff55e598170eb3` ✓
- `MP_PAYER_EMAIL_OVERRIDE` → email del test buyer (ya configurado)
- `APP_URL` → `https://app.fondosylicitaciones.cl` ✓
