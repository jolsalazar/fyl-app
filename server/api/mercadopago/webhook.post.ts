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
  eliminarEventoProcesado,
  esPlanValido,
  obtenerAuthorizedPaymentMercadoPago,
  obtenerPagoMercadoPago,
  obtenerPreapprovalMercadoPago,
  obtenerSuscripcion,
  registrarEventoProcesado,
  verificarFirmaMercadoPago,
  type Plan,
} from '~~/server/utils/mercadopago'
import { DURACION_PROMO_DIAS, getPrecioRegular, tienePromo } from '~~/utils/planes'

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

  const body = await readBody<{
    id?:      string | number   // ID único del evento (top-level)
    type?:    string
    action?:  string
    data?:    { id?: string | number }
  }>(event) ?? {}

  // MercadoPago firma `data.id` desde QUERY PARAMS, no desde body. Body puede
  // no traerlo o tener otro valor en algunos eventos. Preferimos query y caemos
  // al body solo como fallback defensivo (legacy).
  const query        = getQuery(event)
  const dataIdQuery  = query['data.id']
  const dataIdQueryS = Array.isArray(dataIdQuery) ? dataIdQuery[0] : dataIdQuery
  const dataIdBody   = body?.data?.id
  const dataId       = dataIdQueryS
    ? String(dataIdQueryS)
    : (dataIdBody != null ? String(dataIdBody) : null)
  const type         = body.type ?? (typeof query.type === 'string' ? query.type : '')

  // event_id para idempotencia: usar body.id (único por evento). data.id es
  // el id del recurso (preapproval, payment) y se REPITE entre eventos
  // distintos del mismo recurso (pending → authorized usan el mismo data.id).
  // Fallback compuesto si body.id no viene: type:dataId:action.
  const eventIdRaw = body?.id
  const eventId    = eventIdRaw != null
    ? String(eventIdRaw)
    : `${type}:${dataId ?? 'no-data'}:${body?.action ?? 'no-action'}`

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

  // Idempotencia: si MP reenvía el mismo evento (retry, timeout), ignorarlo.
  // Sin esto, failed_payments podría incrementarse múltiples veces para el
  // mismo cobro rechazado y gatillar un downgrade prematuro.
  const eventoNuevo = await registrarEventoProcesado({
    supabaseUrl:    SUPABASE_URL,
    serviceRoleKey: SUPABASE_SERVICE_KEY,
    provider:       'mercadopago',
    eventType:      type,
    eventId,
  })
  if (!eventoNuevo) {
    return { ok: true, ignored: true, reason: 'duplicate_event' }
  }

  // Rollback si el handler falla: si NO marcamos `procesoExitoso = true`
  // antes de retornar, el `finally` elimina el registro y MP reintenta
  // hasta que procese OK. Cada return EXITOSO del handler debe setear
  // `procesoExitoso = true`. Returns de error dejan el flag en false.
  let procesoExitoso = false
  try {

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
      procesoExitoso = true; return { ok: true, status: 'pending', processed: false }
    }

    // authorized: activar el plan y marcar la suscripción como activa.
    // Reconciliación: si NO existe registro local (falló el INSERT en
    // create-preapproval o el flujo se inició por otro canal), creamos la
    // sub aquí. Antes cancelamos otras activas del mismo user para respetar
    // el unique partial index `(user_id) where status in (pending,authorized)`.
    if (sub.status === 'authorized') {
      const local = await obtenerSuscripcion({
        supabaseUrl:    SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_KEY,
        preapprovalId:  sub.id,
      })

      if (!local) {
        // Cancelar otras activas del user (con cancel_reason='upgrade' para
        // que el webhook cancelled de esas no baje a Free).
        const otrasUrl = `${SUPABASE_URL}/rest/v1/subscriptions` +
          `?user_id=eq.${userId}` +
          `&status=in.(pending,authorized)` +
          `&select=id,mp_preapproval_id`
        const otrasRes = await fetch(otrasUrl, {
          headers: {
            apikey:        SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
        })
        const otras = otrasRes.ok
          ? await otrasRes.json() as Array<{ id: string; mp_preapproval_id: string }>
          : []
        for (const o of otras) {
          await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?id=eq.${o.id}`, {
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
          })
          await fetch(`https://api.mercadopago.com/preapproval/${o.mp_preapproval_id}`, {
            method:  'PUT',
            headers: {
              Authorization:  `Bearer ${MP_ACCESS_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: 'cancelled' }),
          }).catch(() => { /* best-effort */ })
        }

        // INSERT del registro local con datos derivados de MP + planes.ts.
        // Para promo_ends_at usamos date_created de MP si está disponible
        // (no `now()` — el webhook puede llegar retrasado y eso extendería
        // la promo más allá del plazo real).
        const planTipado    = plan as Plan
        const currentAmount = sub.auto_recurring?.transaction_amount ?? getPrecioRegular(planTipado)
        const regularAmount = getPrecioRegular(planTipado)
        const fechaInicio   = sub.date_created ? new Date(sub.date_created) : new Date()
        const promoEndsAt   = tienePromo(planTipado)
          ? new Date(fechaInicio.getTime() + DURACION_PROMO_DIAS * 24 * 60 * 60 * 1000).toISOString()
          : null

        const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions`, {
          method:  'POST',
          headers: {
            apikey:         SUPABASE_SERVICE_KEY,
            Authorization:  `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            Prefer:         'return=minimal',
          },
          body: JSON.stringify({
            user_id:           userId,
            plan,
            mp_preapproval_id: sub.id,
            status:            'authorized',
            current_amount:    currentAmount,
            regular_amount:    regularAmount,
            promo_applied:     false,
            promo_ends_at:     promoEndsAt,
            started_at:        new Date().toISOString(),
          }),
        })
        if (!insertRes.ok) {
          console.error('[webhook] reconcile insert failed:', await insertRes.text())
          setResponseStatus(event, 500)
          return { ok: false, error: 'reconcile_insert_failed' }
        }
      } else {
        // Caso normal: la sub ya existía como pending → la marcamos authorized
        const ok = await actualizarSuscripcion({
          supabaseUrl:    SUPABASE_URL,
          serviceRoleKey: SUPABASE_SERVICE_KEY,
          preapprovalId:  sub.id,
          patch: {
            status:           'authorized',
            started_at:       new Date().toISOString(),
            failed_payments:  0,
          },
        })
        if (!ok) {
          setResponseStatus(event, 500)
          return { ok: false, error: 'subscription_update_failed' }
        }
      }

      // Asignar plan al usuario
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

      procesoExitoso = true; return { ok: true, processed: true, action: 'authorized', reconciled: !local }
    }

    // paused/cancelled: actualizar estado. El downgrade a free se hace
    // explícitamente solo cuando se cancela (no en paused — paused puede ser
    // temporal por fallo de cobro y se reintenta).
    if (sub.status === 'cancelled') {
      // Leer el registro local ANTES de actualizar para conocer cancel_reason.
      // Si la cancelación fue por upgrade, NO bajar el plan a Free — la sub
      // nueva (pending/authorized) asignará el plan correcto.
      const local = await obtenerSuscripcion({
        supabaseUrl:    SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_KEY,
        preapprovalId:  sub.id,
      })
      const esUpgrade = local?.cancel_reason === 'upgrade'

      await actualizarSuscripcion({
        supabaseUrl:    SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_KEY,
        preapprovalId:  sub.id,
        patch: {
          status:       'cancelled',
          cancelled_at: new Date().toISOString(),
        },
      })

      if (!esUpgrade) {
        await asignarPlanUsuario({
          supabaseUrl:    SUPABASE_URL,
          serviceRoleKey: SUPABASE_SERVICE_KEY,
          userId,
          plan: 'free' as Plan,
        })
      }
      procesoExitoso = true; return { ok: true, processed: true, action: 'cancelled', upgrade: esUpgrade }
    }

    if (sub.status === 'paused') {
      await actualizarSuscripcion({
        supabaseUrl:    SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_KEY,
        preapprovalId:  sub.id,
        patch: { status: 'paused' },
      })
      procesoExitoso = true; return { ok: true, processed: true, action: 'paused' }
    }

    procesoExitoso = true; return { ok: true, status: sub.status, processed: false, reason: 'unknown_status' }
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
      procesoExitoso = true; return { ok: true, ignored: true, reason: 'no_local_subscription' }
    }

    if (pay.status === 'approved') {
      // Reactivación: si la sub local NO está authorized (la marcamos cancelled
      // por 3 fallos pero el PUT MP cancelar falló y ahora MP cobra OK), hay que
      // reactivar el plan. Sino el usuario paga y se queda en Free.
      const necesitaReactivar = sub.status !== 'authorized'

      const patch: Record<string, unknown> = {
        last_payment_at: new Date().toISOString(),
        failed_payments: 0,
      }
      if (necesitaReactivar) {
        patch.status        = 'authorized'
        patch.cancelled_at  = null
        patch.cancel_reason = null
      }

      await actualizarSuscripcion({
        supabaseUrl:    SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_KEY,
        preapprovalId:  pay.preapproval_id,
        patch,
      })

      if (necesitaReactivar && esPlanValido(sub.plan)) {
        await asignarPlanUsuario({
          supabaseUrl:    SUPABASE_URL,
          serviceRoleKey: SUPABASE_SERVICE_KEY,
          userId:         sub.user_id,
          plan:           sub.plan as Plan,
        })
      }

      procesoExitoso = true; return { ok: true, processed: true, action: 'payment_approved', reactivated: necesitaReactivar }
    }

    if (pay.status === 'rejected') {
      const fallidos = (sub.failed_payments ?? 0) + 1
      const llegoAlLimite = fallidos >= MAX_FAILED_PAYMENTS

      // Si llegamos al límite, cancelamos la preapproval en MP también — sino
      // MP seguiría reintentando aunque ya bajamos al usuario a Free. La marca
      // local pasa a 'cancelled' (no 'paused') con cancel_reason='failed_payments'
      // para que el webhook cancelled que llegará después sea idempotente.
      const patch: Record<string, unknown> = { failed_payments: fallidos }
      if (llegoAlLimite) {
        patch.status        = 'cancelled'
        patch.cancel_reason = 'failed_payments'
        patch.cancelled_at  = new Date().toISOString()
      }

      await actualizarSuscripcion({
        supabaseUrl:    SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_KEY,
        preapprovalId:  pay.preapproval_id,
        patch,
      })

      if (llegoAlLimite) {
        // Cancelar en MP (best-effort: si falla, marcamos local igual y
        // dependemos de que MP eventualmente nos avise vía preapproval webhook)
        await fetch(`https://api.mercadopago.com/preapproval/${pay.preapproval_id}`, {
          method:  'PUT',
          headers: {
            Authorization:  `Bearer ${MP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'cancelled' }),
        }).catch(err => console.error('[webhook] cancel MP after failed payments:', err))

        // Downgrade a Free
        await asignarPlanUsuario({
          supabaseUrl:    SUPABASE_URL,
          serviceRoleKey: SUPABASE_SERVICE_KEY,
          userId:         sub.user_id,
          plan:           'free' as Plan,
        })
      }

      procesoExitoso = true; return { ok: true, processed: true, action: 'payment_rejected', failed: fallidos, downgraded: llegoAlLimite }
    }

    procesoExitoso = true; return { ok: true, status: pay.status, processed: false }
  }

  // ── PAYMENT: pago único (legacy create-preference, se mantiene por compat) ──
  if (type === 'payment') {
    const pago = await obtenerPagoMercadoPago(dataId, MP_ACCESS_TOKEN)
    if (!pago) {
      setResponseStatus(event, 502)
      return { ok: false, error: 'payment_fetch_failed' }
    }

    if (pago.status !== 'approved') {
      procesoExitoso = true; return { ok: true, status: pago.status, processed: false }
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

    procesoExitoso = true; return { ok: true, processed: true, type: 'payment', userId, plan }
  }

  // Ignorar cualquier otro tipo (merchant_order, plans, etc.)
  procesoExitoso = true
  return { ok: true, ignored: true, type }

  } finally {
    // Rollback: si el handler falló (no marcó procesoExitoso) eliminamos el
    // registro de evento procesado para que MP pueda reintentar.
    if (!procesoExitoso) {
      await eliminarEventoProcesado({
        supabaseUrl:    SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_KEY,
        provider:       'mercadopago',
        eventType:      type,
        eventId,
      })
    }
  }
})
