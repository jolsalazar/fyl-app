// Crea una SUSCRIPCIÓN recurrente en MercadoPago (preapproval) para que el usuario
// logueado contrate un plan. El cobro es mensual y MP lo gestiona automáticamente.
//
// El frontend hace POST { plan } y recibe { init_point } para redirigir al checkout
// de MP. Cuando el usuario autoriza, MP envía un webhook (type='preapproval',
// action='created' y luego status='authorized') y ahí se activa el plan.
//
// Variables de entorno requeridas:
//   MP_ACCESS_TOKEN          Access token del vendedor
//   MP_PAYER_EMAIL_OVERRIDE  (opcional) Email pagador para pruebas con test users
//   APP_URL                  URL pública de la app (back_url)
//   SUPABASE_URL             Para insertar la subscription
//   SUPABASE_SERVICE_KEY     Service role para escritura sin RLS

import { PLANES_CONFIG, esPlanValido, getPrecioInicial, getPrecioRegular, tienePromo, DURACION_PROMO_DIAS, type Plan } from '~~/utils/planes'
import { cancelarPreapprovalMercadoPago } from '~~/server/utils/mercadopago'
import { serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const MP_ACCESS_TOKEN      = process.env.MP_ACCESS_TOKEN
  const MP_PAYER_EMAIL_OVERRIDE = process.env.MP_PAYER_EMAIL_OVERRIDE?.trim()
  const APP_URL              = process.env.APP_URL?.replace(/\/+$/, '')
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

  const profileUrl = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=id`
  const profileRes = await fetch(profileUrl, {
    headers: {
      apikey:        SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  })
  if (!profileRes.ok) {
    setResponseStatus(event, 500)
    return { ok: false, error: 'profile_lookup_failed' }
  }

  const profiles = await profileRes.json() as Array<{ id: string }>
  if (profiles.length === 0) {
    const createProfileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method:  'POST',
      headers: {
        apikey:         SUPABASE_SERVICE_KEY,
        Authorization:  `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer:         'return=minimal',
      },
      body: JSON.stringify({ id: user.id, intended_plan: plan }),
    })

    if (!createProfileRes.ok) {
      console.error('[create-preapproval] profile create failed:', await createProfileRes.text())
      setResponseStatus(event, 500)
      return { ok: false, error: 'profile_create_failed' }
    }
  }

  // promo_ends_at = ahora + 90 días (solo planes con promo)
  const promoEndsAt = hayPromo
    ? new Date(Date.now() + DURACION_PROMO_DIAS * 24 * 60 * 60 * 1000).toISOString()
    : null

  // ── Upgrade/downgrade: cancelar suscripciones activas previas del usuario.
  // El unique partial index (user_id where status in pending/authorized) impide
  // INSERTar la nueva si quedan activas. Marcamos cancel_reason='upgrade' para
  // que el webhook cancelled NO baje el plan a Free (la nueva sub asignará el
  // plan correcto cuando se autorice).
  const queryActivas = `${SUPABASE_URL}/rest/v1/subscriptions` +
    `?user_id=eq.${user.id}` +
    `&status=in.(pending,authorized)` +
    `&select=id,mp_preapproval_id,status`

  const activasRes = await fetch(queryActivas, {
    headers: {
      apikey:        SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  })
  const activas = activasRes.ok
    ? await activasRes.json() as Array<{ id: string; mp_preapproval_id: string; status: string }>
    : []

  // Track de las que ya cancelamos para hacer rollback si falla a mitad.
  const yaCanceladas: typeof activas = []

  async function rollbackCanceladas() {
    // Si abortamos a mitad del bucle (o falla crear nueva más adelante),
    // las que ya cancelamos quedan con cancel_reason='upgrade' aunque NO
    // habrá upgrade real. Convertir a 'user' para que el webhook cancelled
    // SÍ baje el plan a Free, y forzar downgrade para no esperar al webhook.
    for (const c of yaCanceladas) {
      await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?id=eq.${c.id}`, {
        method:  'PATCH',
        headers: {
          apikey:         SUPABASE_SERVICE_KEY,
          Authorization:  `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer:         'return=minimal',
        },
        body: JSON.stringify({ cancel_reason: 'user' }),
      }).catch(() => { /* best-effort */ })
    }
    if (yaCanceladas.length > 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_set_user_plan`, {
        method:  'POST',
        headers: {
          apikey:         SUPABASE_SERVICE_KEY,
          Authorization:  `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ target_id: user.id, new_plan: 'free' }),
      }).catch(() => { /* best-effort */ })
    }
  }

  for (const ant of activas) {
    // 1. Cancelar en MP PRIMERO. Si MP responde cualquier error explícito
    //    (4xx o 5xx), abortar: no podemos asumir que MP procesó la
    //    cancelación. Si seguimos, MP podría cobrar tanto la vieja como
    //    la nueva. Solo errores de red (catch) son best-effort.
    let mpCancelOk = true
    let mpCancelStatus: number | null = null
    let mpCancelBody = ''
    try {
      const mpCancelRes = await cancelarPreapprovalMercadoPago(ant.mp_preapproval_id, MP_ACCESS_TOKEN)
      if (!mpCancelRes.ok) {
        mpCancelStatus = mpCancelRes.status
        mpCancelBody = mpCancelRes.body
        console.error('[create-preapproval] MP rechazó cancelar previa:', mpCancelRes.status, mpCancelRes.body)
        mpCancelOk = false
      }
    } catch (err) {
      // Error de red (sin status). Tratamos como best-effort: continuamos
      // asumiendo que MP eventualmente procesará / mirará el state después.
      console.error('[create-preapproval] MP cancel network error:', err)
    }

    if (!mpCancelOk) {
      // Durante las pruebas podemos quedar con preapprovals pending creadas con
      // otro vendedor/token. MP no permite cancelarlas con el token actual
      // ("Invalid action for user"), pero al estar pending no hay cobro activo.
      // Las cerramos localmente para liberar el índice y permitir crear la real.
      const isInvalidSellerPending =
        ant.status === 'pending' &&
        mpCancelStatus === 401 &&
        mpCancelBody.includes('Invalid action for user')

      if (isInvalidSellerPending) {
        console.error('[create-preapproval] cancelando localmente preapproval pending de otro vendedor:', ant.mp_preapproval_id)
      } else {
      // Rollback de las que ya cancelamos correctamente
        await rollbackCanceladas()
        setResponseStatus(event, 409)
        return {
          ok: false,
          error: 'previous_cancel_failed',
          detail: ant.status === 'authorized'
            ? 'previous_subscription_authorized_with_different_seller'
            : 'previous_subscription_could_not_be_cancelled',
        }
      }
    }

    // 2. Marcar local cancelled con razón upgrade (libera el unique index)
    await fetch(
      `${SUPABASE_URL}/rest/v1/subscriptions?id=eq.${ant.id}`,
      {
        method:  'PATCH',
        headers: {
          apikey:         SUPABASE_SERVICE_KEY,
          Authorization:  `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer:         'return=minimal',
        },
        body: JSON.stringify({
          status:        'cancelled',
          cancel_reason: 'upgrade',
          cancelled_at:  new Date().toISOString(),
        }),
      },
    )
    yaCanceladas.push(ant)
  }

  const preapproval = {
    reason:             `Plan ${PLANES_CONFIG[plan as Plan].nombre} - Fondos y Licitaciones`,
    external_reference: `${user.id}:${plan}`,
    payer_email:        MP_PAYER_EMAIL_OVERRIDE || user.email,
    back_url:           `${APP_URL}/dashboard`,
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
    const mpError = await mpRes.text().catch(() => '(no body)')
    const mpRequestId = mpRes.headers.get('x-request-id') ?? mpRes.headers.get('x-correlation-id')
    console.error('[create-preapproval] MP rechazó preapproval:', {
      status: mpRes.status,
      mpRequestId,
      detail: mpError,
      payload: {
        reason: preapproval.reason,
        external_reference: preapproval.external_reference,
        payer_email: preapproval.payer_email,
        back_url: preapproval.back_url,
        auto_recurring: preapproval.auto_recurring,
        status: preapproval.status,
      },
    })
    await rollbackCanceladas()
    setResponseStatus(event, 422)
    return {
      ok:            false,
      error:         'preapproval_creation_failed',
      mp_status:     mpRes.status,
      mp_request_id: mpRequestId,
      mp_detail:     mpError,
      mp_payload: {
        payer_email:    preapproval.payer_email,
        transaction_amount: preapproval.auto_recurring.transaction_amount,
        currency_id:    preapproval.auto_recurring.currency_id,
        end_date:       preapproval.auto_recurring.end_date,
        status:         preapproval.status,
      },
    }
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
