// Crea una SUSCRIPCIÓN recurrente en MercadoPago (preapproval) para que el usuario
// logueado contrate un plan. El cobro es mensual y MP lo gestiona automáticamente.
//
// El frontend hace POST { plan } y recibe { init_point } para redirigir al checkout
// de MP. Cuando el usuario autoriza, MP envía un webhook (type='preapproval',
// action='created' y luego status='authorized') y ahí se activa el plan.
//
// Variables de entorno requeridas:
//   MP_ACCESS_TOKEN          Access token del vendedor
//   APP_URL                  URL pública de la app (back_url)
//   SUPABASE_URL             Para insertar la subscription
//   SUPABASE_SERVICE_KEY     Service role para escritura sin RLS

import { PLANES_CONFIG, esPlanValido, getPrecioInicial, getPrecioRegular, tienePromo, DURACION_PROMO_DIAS, type Plan } from '~~/utils/planes'
import { serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const MP_ACCESS_TOKEN      = process.env.MP_ACCESS_TOKEN
  const APP_URL              = process.env.APP_URL
  const SUPABASE_URL         = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

  if (!MP_ACCESS_TOKEN || !APP_URL || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    setResponseStatus(event, 503)
    return { ok: false, error: 'mercadopago_not_configured' }
  }

  const user = await serverSupabaseUser(event)
  if (!user || !user.email) {
    setResponseStatus(event, 401)
    return { ok: false, error: 'unauthorized' }
  }

  const body = await readBody<{ plan?: string }>(event) ?? {}
  const plan = body.plan
  if (!plan || !esPlanValido(plan) || plan === 'free') {
    setResponseStatus(event, 400)
    return { ok: false, error: 'invalid_plan' }
  }

  const precioInicial = getPrecioInicial(plan as Plan)
  const precioRegular = getPrecioRegular(plan as Plan)
  const hayPromo      = tienePromo(plan as Plan)

  // promo_ends_at = ahora + 90 días (solo planes con promo)
  const promoEndsAt = hayPromo
    ? new Date(Date.now() + DURACION_PROMO_DIAS * 24 * 60 * 60 * 1000).toISOString()
    : null

  const preapproval = {
    reason:             `Plan ${PLANES_CONFIG[plan as Plan].nombre} — Fondos y Licitaciones`,
    external_reference: `${user.id}:${plan}`,
    payer_email:        user.email,
    back_url:           `${APP_URL}/dashboard?sub=pending`,
    auto_recurring: {
      frequency:          1,
      frequency_type:     'months',
      transaction_amount: precioInicial,
      currency_id:        'CLP',
    },
    status: 'pending',
  }

  const mpRes = await fetch('https://api.mercadopago.com/preapproval', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(preapproval),
  })

  if (!mpRes.ok) {
    setResponseStatus(event, 502)
    return { ok: false, error: 'preapproval_creation_failed' }
  }

  const mpData = await mpRes.json() as {
    id:          string
    init_point:  string
    status:      string
  }

  // Insertar registro en subscriptions vía REST con service_role (bypass RLS).
  // Si falla, igualmente devolvemos init_point — el webhook puede crear el registro
  // cuando llegue la autorización (idempotencia). Pero logeamos el error.
  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions`, {
    method:  'POST',
    headers: {
      apikey:         SUPABASE_SERVICE_KEY,
      Authorization:  `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer:         'return=minimal',
    },
    body: JSON.stringify({
      user_id:           user.id,
      plan,
      mp_preapproval_id: mpData.id,
      status:            'pending',
      current_amount:    precioInicial,
      regular_amount:    precioRegular,
      promo_ends_at:     promoEndsAt,
    }),
  })

  if (!insertRes.ok) {
    // No bloquear: el usuario puede continuar al checkout. El webhook reconciliará.
    console.error('[create-preapproval] insert subscription failed:', await insertRes.text())
  }

  return { ok: true, id: mpData.id, init_point: mpData.init_point }
})
