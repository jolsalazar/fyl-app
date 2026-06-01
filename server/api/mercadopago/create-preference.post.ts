// Crea una preferencia de pago mensual NO recurrente en MercadoPago para que
// el usuario logueado contrate un plan por 30 días.
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
import { PLANES_CONFIG, esPlanValido, getPrecioInicial, type Plan } from '~~/utils/planes'
import { serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN
  const APP_URL         = process.env.APP_URL?.replace(/\/+$/, '')

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

  // Precio único y permanente del plan.
  const unitPrice = getPrecioInicial(plan)

  const preference = {
    items: [
      {
        title:       `Plan ${PLANES_CONFIG[plan].nombre}`,
        quantity:    1,
        currency_id: 'CLP',
        unit_price:  unitPrice,
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
    const mpError = await res.text().catch(() => '(no body)')
    const mpRequestId = res.headers.get('x-request-id') ?? res.headers.get('x-correlation-id')
    console.error('[create-preference] MP rechazó preference:', {
      status: res.status,
      mpRequestId,
      detail: mpError,
      payload: {
        payer_email: user.email,
        unit_price: unitPrice,
        currency_id: 'CLP',
        external_reference: preference.external_reference,
      },
    })
    setResponseStatus(event, 502)
    return {
      ok:            false,
      error:         'preference_creation_failed',
      mp_status:     res.status,
      mp_request_id: mpRequestId,
      mp_detail:     mpError,
    }
  }

  const data = await res.json() as { id: string; init_point: string; sandbox_init_point: string }
  return { ok: true, id: data.id, init_point: data.init_point }
})
