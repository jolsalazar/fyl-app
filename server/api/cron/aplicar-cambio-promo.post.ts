// Cron diario: aplica el cambio de precio promo→regular en suscripciones que
// ya cumplieron sus 90 días promocionales. Hace PATCH a la preapproval en MP
// para subir transaction_amount al monto regular y actualiza el registro local.
//
// Auth: header `x-cron-secret` debe coincidir con env CRON_SECRET. Esto evita
// que cualquiera dispare el endpoint y altere las suscripciones.
//
// Idempotencia: el WHERE filtra `promo_applied = false`, así que correr el cron
// dos veces el mismo día no aplica el cambio dos veces.
//
// Variables de entorno requeridas:
//   CRON_SECRET           Secreto compartido para autenticar el cron
//   MP_ACCESS_TOKEN       Para PATCH a preapproval
//   SUPABASE_URL          Para queries de subscriptions
//   SUPABASE_SERVICE_KEY  Bypass RLS
//   RESEND_API_KEY        Para email de confirmación

import { PLANES_CONFIG, esPlanValido, type Plan } from '~~/utils/planes'
import { emailCambioPromoAplicado, enviarEmail } from '~~/server/utils/email'

type Subscription = {
  id:                string
  user_id:           string
  plan:              Plan
  mp_preapproval_id: string
  current_amount:    number
  regular_amount:    number
  promo_ends_at:     string
}

export default defineEventHandler(async (event) => {
  const CRON_SECRET          = process.env.CRON_SECRET
  const MP_ACCESS_TOKEN      = process.env.MP_ACCESS_TOKEN
  const SUPABASE_URL         = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

  if (!CRON_SECRET || !MP_ACCESS_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    setResponseStatus(event, 503)
    return { ok: false, error: 'cron_not_configured' }
  }

  const headers = getRequestHeaders(event)
  if (headers['x-cron-secret'] !== CRON_SECRET) {
    setResponseStatus(event, 401)
    return { ok: false, error: 'unauthorized' }
  }

  // Buscar suscripciones que ya cumplieron promo y aún no se actualizaron.
  const nowIso = new Date().toISOString()
  const queryUrl = `${SUPABASE_URL}/rest/v1/subscriptions` +
    `?status=eq.authorized` +
    `&promo_applied=eq.false` +
    `&promo_ends_at=lte.${encodeURIComponent(nowIso)}` +
    `&select=id,user_id,plan,mp_preapproval_id,current_amount,regular_amount,promo_ends_at`

  const queryRes = await fetch(queryUrl, {
    headers: {
      apikey:        SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  })
  if (!queryRes.ok) {
    setResponseStatus(event, 500)
    return { ok: false, error: 'query_failed' }
  }

  const subs = await queryRes.json() as Subscription[]
  const resultados: Array<{ id: string; ok: boolean; error?: string }> = []

  for (const sub of subs) {
    if (!esPlanValido(sub.plan)) {
      resultados.push({ id: sub.id, ok: false, error: 'invalid_plan' })
      continue
    }

    // 1. PATCH a MP para subir el monto cobrado mensualmente.
    const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${sub.mp_preapproval_id}`, {
      method:  'PUT',
      headers: {
        Authorization:  `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        auto_recurring: {
          transaction_amount: sub.regular_amount,
          currency_id:        'CLP',
        },
      }),
    })

    if (!mpRes.ok) {
      const errBody = await mpRes.text()
      console.error(`[cron-promo] PATCH MP falló para ${sub.id}:`, mpRes.status, errBody)
      resultados.push({ id: sub.id, ok: false, error: `mp_patch_failed_${mpRes.status}` })
      continue
    }

    // 2. Actualizar registro local. El WHERE garantiza idempotencia y
    //    seguridad: solo actualiza si la suscripción sigue authorized
    //    (el usuario podría haber cancelado entre el SELECT y este UPDATE).
    //    Usamos return=representation para detectar 0 filas afectadas — sin
    //    eso podríamos enviar email "promo cambiada" sin haber actualizado.
    const updateRes = await fetch(
      `${SUPABASE_URL}/rest/v1/subscriptions?id=eq.${sub.id}&promo_applied=eq.false&status=eq.authorized`,
      {
        method:  'PATCH',
        headers: {
          apikey:         SUPABASE_SERVICE_KEY,
          Authorization:  `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer:         'return=representation',
        },
        body: JSON.stringify({
          current_amount: sub.regular_amount,
          promo_applied:  true,
        }),
      },
    )

    if (!updateRes.ok) {
      console.error(`[cron-promo] UPDATE local falló para ${sub.id}:`, await updateRes.text())
      resultados.push({ id: sub.id, ok: false, error: 'local_update_failed' })
      continue
    }

    const filasActualizadas = await updateRes.json() as unknown[]
    if (filasActualizadas.length === 0) {
      // La sub fue cancelada/promo aplicada entre SELECT y UPDATE — skip email.
      resultados.push({ id: sub.id, ok: false, error: 'no_rows_updated' })
      continue
    }

    // 3. Email de confirmación al usuario (no bloqueante: si falla, el cambio
    //    de precio ya quedó hecho y no queremos revertir).
    const userRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users/${sub.user_id}`,
      {
        headers: {
          apikey:        SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      },
    )
    const userData = userRes.ok ? await userRes.json() as { email?: string } : null

    if (userData?.email) {
      const tpl = emailCambioPromoAplicado({
        nombrePlan:    PLANES_CONFIG[sub.plan].nombre,
        precioRegular: sub.regular_amount,
      })
      enviarEmail({ to: userData.email, ...tpl }).catch(err => {
        console.error(`[cron-promo] email falló para ${sub.user_id}:`, err)
      })
    }

    resultados.push({ id: sub.id, ok: true })
  }

  return {
    ok:        true,
    procesados: resultados.length,
    exitosos:   resultados.filter(r => r.ok).length,
    errores:    resultados.filter(r => !r.ok).length,
    detalle:    resultados,
  }
})
