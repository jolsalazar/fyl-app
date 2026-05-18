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

**Fix aplicado:** se actualizó la variable en Cloudflare con el valor correcto del panel de MP (ver Cloudflare → vars).

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
| `MP_ACCESS_TOKEN` | token TEST de la cuenta real `jolsalazar@gmail.com` | **cuenta REAL en modo test** |
| `payer_email` | email del test buyer (ver gestor de secretos) | **cuenta TEST** |

MP rechaza la combinación. Error literal: `"Both payer and collector must be real or test users"`.

---

## Qué hay que hacer para cerrar la brecha

### Paso 1 — Obtener el `client_secret` de la app

Ir a `https://www.mercadopago.cl/developers/panel/app`, seleccionar la app correspondiente, y copiar el **client secret** (sección de credenciales).

### Paso 2 — Obtener el access token del test seller

Con el `client_secret` en mano, correr el siguiente curl (rellenar con los valores reales desde el gestor de secretos, **no commitear**):

```bash
source .env && curl -s -X POST "https://api.mercadopago.com/oauth/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password&client_id=<MP_CLIENT_ID>&client_secret=<MP_CLIENT_SECRET>&username=<TEST_SELLER_EMAIL_URLENCODED>&password=<TEST_SELLER_PASSWORD>"
```

La respuesta incluye `access_token`. Ese es el token del **test seller**.

### Paso 3 — Actualizar variables en Cloudflare

| Variable en Cloudflare | Nuevo valor |
|---|---|
| `MP_ACCESS_TOKEN` | access token del test seller (del paso 2) |
| `MP_PAYER_EMAIL_OVERRIDE` | email del test buyer (ver gestor de secretos) |

### Paso 4 — Probar el flujo completo

1. Entrar a la app con cualquier cuenta
2. Ir a `/planes`, elegir Starter
3. En el checkout de MP, logarse con el **test buyer** (credenciales en el gestor de secretos)
4. Seleccionar una tarjeta de prueba y completar el pago
5. Verificar que llega el webhook y el plan se activa en la BD

---

## Credenciales de test creadas

> Las cuentas test fueron creadas con la API de MP el 2026-05-15. Email/contraseña/ID de los test users (seller y buyer) están en el **gestor de secretos**, no en este repo. No hay forma de recuperarlas si se pierden; si se pierden, crear nuevas con la skill `mercadopago:mp-test-setup`.

---

## Advertencia de seguridad pendiente

Durante la sesión de trabajo del 2026-05-15 se compartieron en texto plano: el access token de producción (`APP_USR-…`), el `MP_WEBHOOK_SECRET` y las credenciales de los test users. **Todos esos valores fueron rotados el 2026-05-17.** Si en algún momento se vuelven a exponer, rotar de inmediato en el panel de MP y actualizar en Cloudflare.

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
- `MP_WEBHOOK_SECRET` → configurado ✓
- `MP_PAYER_EMAIL_OVERRIDE` → email del test buyer (ya configurado)
- `APP_URL` → `https://app.fondosylicitaciones.cl` ✓
