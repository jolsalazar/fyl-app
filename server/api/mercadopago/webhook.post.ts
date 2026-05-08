// Webhook de MercadoPago: recibe notificaciones, valida firma, y procesa según el type:
//
//   type='payment'                        → pago único (legacy create-preference)
//   type='preapproval'                    → cambio de estado de suscripción
//                                            (pending → authorized → paused/cancelled)
//   type='subscription_authorized_payment'→ cobro mensual recurrente de una suscripción
//
// Variables de entorno requeridas:
//   MP_WEBHOOK_SECRET    Secret de firma del webhook (panel MP > Webhooks)
//   MP_ACCESS_TOKEN      Access token del vendedor
//   SUPABASE_URL         URL del proyecto Supabase
//   SUPABASE_SERVICE_KEY Service role key (NO la anon key) — bypass RLS
//
// External_reference convención: "<user_id>:<plan>".
// Idempotencia: las operaciones DB usan UPDATE/UPSERT, así que recibir el mismo
// evento dos veces no genera duplicados.

import {
  actualizarSuscripcion,
  asignarPlanUsuario,
  esPlanValido,
  obtenerAuthorizedPaymentMercadoPago,
  obtenerPagoMercadoPago,
  obtenerPreapprovalMercadoPago,
  obtenerSuscripcion,
  verificarFirmaMercadoPago,
  type Plan,
} from '~~/server/utils/mercadopago'

const MAX_FAILED_PAYMENTS = 3 // tras 3 cobros consecutivos rechazados → downgrade a free

export default defineEventHandler(async (event) => {
  const MP_WEBHOOK_SECRET    = process.env.MP_WEBHOOK_SECRET
  const MP_ACCESS_TOKEN      = process.env.MP_ACCESS_TOKEN
  const SUPABASE_URL         = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

  if (!MP_WEBHOOK_SECRET || !MP_ACCESS_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    setResponseStatus(event, 503)
    return { ok: false, error: 'mercadopago_not_configured' }
  }

  const body = await readBody<{ type?: string; action?: string; data?: { id?: string | number } }>(event) ?? {}
  const dataId = body?.data?.id != null ? String(body.data.id) : null
  const type   = body.type ?? ''

  if (!dataId) {
    return { ok: true, ignored: true, reason: 'no_data_id' }
  }

  // Validación de firma — crítica para evitar que cualquiera active planes falsos.
  const headers = getRequestHeaders(event)
  const firmaOk = await verificarFirmaMercadoPago({
    signatureHeader: headers['x-signature'],
    requestId:       headers['x-request-id'],
    dataId,
    secret:          MP_WEBHOOK_SECRET,
  })
  if (!firmaOk) {
    setResponseStatus(event, 401)
    return { ok: false, error: 'invalid_signature' }
  }

  // ── PREAPPROVAL: cambio de estado de la suscripción ───────────────────────
  if (type === 'preapproval') {
    const sub = await obtenerPreapprovalMercadoPago(dataId, MP_ACCESS_TOKEN)
    if (!sub) {
      setResponseStatus(event, 502)
      return { ok: false, error: 'preapproval_fetch_failed' }
    }

    const [userId, plan] = (sub.external_reference ?? '').split(':')
    if (!userId || !plan || !esPlanValido(plan)) {
      setResponseStatus(event, 400)
      return { ok: false, error: 'invalid_external_reference' }
    }

    // Estado pending: no hacer nada — esperar a que el usuario autorice.
    if (sub.status === 'pending') {
      return { ok: true, status: 'pending', processed: false }
    }

    // authorized: activar el plan y marcar la suscripción como activa.
    if (sub.status === 'authorized') {
      const asignado = await asignarPlanUsuario({
        supabaseUrl:    SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_KEY,
        userId,
        plan: plan as Plan,
      })
      if (!asignado) {
        setResponseStatus(event, 500)
        return { ok: false, error: 'plan_assign_failed' }
      }

      await actualizarSuscripcion({
        supabaseUrl:    SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_KEY,
        preapprovalId:  sub.id,
        patch: {
          status:           'authorized',
          started_at:       new Date().toISOString(),
          failed_payments:  0,
        },
      })
      return { ok: true, processed: true, action: 'authorized' }
    }

    // paused/cancelled: actualizar estado. El downgrade a free se hace
    // explícitamente solo cuando se cancela (no en paused — paused puede ser
    // temporal por fallo de cobro y se reintenta).
    if (sub.status === 'cancelled') {
      await actualizarSuscripcion({
        supabaseUrl:    SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_KEY,
        preapprovalId:  sub.id,
        patch: {
          status:       'cancelled',
          cancelled_at: new Date().toISOString(),
        },
      })
      // Downgrade a free al cancelar
      await asignarPlanUsuario({
        supabaseUrl:    SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_KEY,
        userId,
        plan: 'free' as Plan,
      })
      return { ok: true, processed: true, action: 'cancelled' }
    }

    if (sub.status === 'paused') {
      await actualizarSuscripcion({
        supabaseUrl:    SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_KEY,
        preapprovalId:  sub.id,
        patch: { status: 'paused' },
      })
      return { ok: true, processed: true, action: 'paused' }
    }

    return { ok: true, status: sub.status, processed: false, reason: 'unknown_status' }
  }

  // ── AUTHORIZED_PAYMENT: cobro mensual de una suscripción ──────────────────
  if (type === 'subscription_authorized_payment' || type === 'authorized_payment') {
    const pay = await obtenerAuthorizedPaymentMercadoPago(dataId, MP_ACCESS_TOKEN)
    if (!pay) {
      setResponseStatus(event, 502)
      return { ok: false, error: 'authorized_payment_fetch_failed' }
    }

    const sub = await obtenerSuscripcion({
      supabaseUrl:    SUPABASE_URL,
      serviceRoleKey: SUPABASE_SERVICE_KEY,
      preapprovalId:  pay.preapproval_id,
    })
    if (!sub) {
      // No tenemos registro local: aceptamos el evento pero no procesamos.
      return { ok: true, ignored: true, reason: 'no_local_subscription' }
    }

    if (pay.status === 'approved') {
      await actualizarSuscripcion({
        supabaseUrl:    SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_KEY,
        preapprovalId:  pay.preapproval_id,
        patch: {
          last_payment_at: new Date().toISOString(),
          failed_payments: 0,
        },
      })
      return { ok: true, processed: true, action: 'payment_approved' }
    }

    if (pay.status === 'rejected') {
      const fallidos = (sub.failed_payments ?? 0) + 1
      const llegoAlLimite = fallidos >= MAX_FAILED_PAYMENTS

      await actualizarSuscripcion({
        supabaseUrl:    SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_KEY,
        preapprovalId:  pay.preapproval_id,
        patch: {
          failed_payments: fallidos,
          ...(llegoAlLimite ? { status: 'paused' } : {}),
        },
      })

      // Tras 3 fallos consecutivos: downgrade a free
      if (llegoAlLimite) {
        await asignarPlanUsuario({
          supabaseUrl:    SUPABASE_URL,
          serviceRoleKey: SUPABASE_SERVICE_KEY,
          userId:         sub.user_id,
          plan:           'free' as Plan,
        })
      }

      return { ok: true, processed: true, action: 'payment_rejected', failed: fallidos, downgraded: llegoAlLimite }
    }

    return { ok: true, status: pay.status, processed: false }
  }

  // ── PAYMENT: pago único (legacy create-preference, se mantiene por compat) ──
  if (type === 'payment') {
    const pago = await obtenerPagoMercadoPago(dataId, MP_ACCESS_TOKEN)
    if (!pago) {
      setResponseStatus(event, 502)
      return { ok: false, error: 'payment_fetch_failed' }
    }

    if (pago.status !== 'approved') {
      return { ok: true, status: pago.status, processed: false }
    }

    const [userId, plan] = (pago.external_reference ?? '').split(':')
    if (!userId || !plan || !esPlanValido(plan)) {
      setResponseStatus(event, 400)
      return { ok: false, error: 'invalid_external_reference' }
    }

    const asignado = await asignarPlanUsuario({
      supabaseUrl:    SUPABASE_URL,
      serviceRoleKey: SUPABASE_SERVICE_KEY,
      userId,
      plan: plan as Plan,
    })
    if (!asignado) {
      setResponseStatus(event, 500)
      return { ok: false, error: 'rpc_failed' }
    }

    return { ok: true, processed: true, type: 'payment', userId, plan }
  }

  // Ignorar cualquier otro tipo (merchant_order, plans, etc.)
  return { ok: true, ignored: true, type }
})
