// Crea una preferencia de pago en MercadoPago para que el usuario logueado contrate un plan.
// El frontend hace POST { plan: 'starter' | 'advanced' | 'agency' } y recibe { init_point }
// para redirigir al checkout de MP.
//
// La identidad del comprador se determina del lado del servidor (auth.getUser), nunca se
// confía en el body del request — eso impedía que un usuario "compre" un plan para otra cuenta.
//
// Variables de entorno requeridas:
//   MP_ACCESS_TOKEN      Access token del vendedor
//   APP_URL              URL pública de la app (para back_urls de MP)
//
// Precios: definidos acá temporalmente. Mover a tabla `planes` en DB cuando exista.

import { esPlanValido, type Plan } from '~~/server/utils/mercadopago'
import { serverSupabaseUser } from '#supabase/server'

const PRECIOS_CLP: Record<Plan, number> = {
  free:     0,
  starter:  4990,
  advanced: 14990,
  agency:   39990,
}

const NOMBRES: Record<Plan, string> = {
  free:     'Plan Free',
  starter:  'Plan Starter',
  advanced: 'Plan Advanced',
  agency:   'Plan Agency',
}

export default defineEventHandler(async (event) => {
  const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN
  const APP_URL         = process.env.APP_URL

  if (!MP_ACCESS_TOKEN || !APP_URL) {
    setResponseStatus(event, 503)
    return { ok: false, error: 'mercadopago_not_configured' }
  }

  const user = await serverSupabaseUser(event)
  if (!user) {
    setResponseStatus(event, 401)
    return { ok: false, error: 'unauthorized' }
  }

  const body = await readBody<{ plan?: string }>(event) ?? {}
  const plan = body.plan
  if (!plan || !esPlanValido(plan) || plan === 'free') {
    setResponseStatus(event, 400)
    return { ok: false, error: 'invalid_plan' }
  }

  const preference = {
    items: [
      {
        title:       NOMBRES[plan],
        quantity:    1,
        currency_id: 'CLP',
        unit_price:  PRECIOS_CLP[plan],
      },
    ],
    payer: {
      email: user.email,
    },
    external_reference: `${user.id}:${plan}`,
    back_urls: {
      success: `${APP_URL}/dashboard?pago=ok`,
      pending: `${APP_URL}/dashboard?pago=pendiente`,
      failure: `${APP_URL}/planes?pago=falla`,
    },
    auto_return:  'approved',
    notification_url: `${APP_URL}/api/mercadopago/webhook`,
    statement_descriptor: 'FyL App',
  }

  const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${MP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(preference),
  })

  if (!res.ok) {
    setResponseStatus(event, 502)
    return { ok: false, error: 'preference_creation_failed' }
  }

  const data = await res.json() as { id: string; init_point: string; sandbox_init_point: string }
  return { ok: true, id: data.id, init_point: data.init_point }
})
