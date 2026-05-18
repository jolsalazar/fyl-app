// Webhook de MercadoPago: recibe notificaciones, valida firma, y procesa según el type:
//
//   type='payment'                        → pago único (legacy create-preference)
//   type='preapproval' | 'subscription_preapproval'
//                                         → cambio de estado de suscripción
//                                            (pending → authorized → paused/cancelled)
//                                            ambos aliases existen: 'preapproval' es la
//                                            integración legacy; 'subscription_preapproval'
//                                            lo envía el panel nuevo ("Planes y suscripciones")
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
  cancelarPreapprovalMercadoPago,
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
  // Fallback: si body.id no viene, agregamos x-request-id (header de MP que
  // es único por request) para evitar colisiones cuando dos eventos distintos
  // del mismo recurso tienen mismo type+action.
  const headersTmp     = getRequestHeaders(event)
  const reqIdForEventId = headersTmp['x-request-id'] ?? 'no-req'
  const eventIdRaw     = body?.id
  const eventId        = eventIdRaw != null
    ? String(eventIdRaw)
    : `${type}:${dataId ?? 'no-data'}:${body?.action ?? 'no-action'}:${reqIdForEventId}`

  if (!dataId) {
    return { ok: true, ignored: true, reason: 'no_data_id' }
  }

  // El botón "Probar" del panel de Mercado Pago envía una notificación sintética
  // con data.id=123456. No corresponde a una preapproval real y puede fallar la
  // firma por usar datos fijos del simulador. La aceptamos solo como healthcheck;
  // no activa planes ni consulta MP.
  const esPruebaPanelMercadoPago =
    dataId === '123456' &&
    String(body?.id ?? '') === '123456' &&
    body?.action === 'updated' &&
    (body?.type === 'subscription_preapproval' || body?.type === 'preapproval')
  if (esPruebaPanelMercadoPago) {
    return { ok: true, test: true, ignored: true }
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
  // MP envía `subscription_preapproval` desde el panel nuevo ("Planes y suscripciones")
  // y `preapproval` desde la integración legacy. Manejamos ambos como el mismo evento.
  if (type === 'preapproval' || type === 'subscription_preapproval') {
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
          await cancelarPreapprovalMercadoPago(o.mp_preapproval_id, MP_ACCESS_TOKEN).catch(() => { /* best-effort */ })
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

      const okUpdate = await actualizarSuscripcion({
        supabaseUrl:    SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_KEY,
        preapprovalId:  sub.id,
        patch: {
          status:       'cancelled',
          cancelled_at: new Date().toISOString(),
        },
      })
      if (!okUpdate) {
        setResponseStatus(event, 500)
        return { ok: false, error: 'subscription_update_failed' }
      }

      if (!esUpgrade) {
        const okPlan = await asignarPlanUsuario({
          supabaseUrl:    SUPABASE_URL,
          serviceRoleKey: SUPABASE_SERVICE_KEY,
          userId,
          plan: 'free' as Plan,
        })
        if (!okPlan) {
          setResponseStatus(event, 500)
          return { ok: false, error: 'plan_downgrade_failed' }
        }
      }
      procesoExitoso = true; return { ok: true, processed: true, action: 'cancelled', upgrade: esUpgrade }
    }

    if (sub.status === 'paused') {
      const okPaused = await actualizarSuscripcion({
        supabaseUrl:    SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_KEY,
        preapprovalId:  sub.id,
        patch: { status: 'paused' },
      })
      if (!okPaused) {
        setResponseStatus(event, 500)
        return { ok: false, error: 'subscription_update_failed' }
      }
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

      const okApprovedUpdate = await actualizarSuscripcion({
        supabaseUrl:    SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_KEY,
        preapprovalId:  pay.preapproval_id,
        patch,
      })
      if (!okApprovedUpdate) {
        setResponseStatus(event, 500)
        return { ok: false, error: 'subscription_update_failed' }
      }

      if (necesitaReactivar && esPlanValido(sub.plan)) {
        const okPlan = await asignarPlanUsuario({
          supabaseUrl:    SUPABASE_URL,
          serviceRoleKey: SUPABASE_SERVICE_KEY,
          userId:         sub.user_id,
          plan:           sub.plan as Plan,
        })
        if (!okPlan) {
          setResponseStatus(event, 500)
          return { ok: false, error: 'plan_reactivate_failed' }
        }
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

      const okRejectedUpdate = await actualizarSuscripcion({
        supabaseUrl:    SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_KEY,
        preapprovalId:  pay.preapproval_id,
        patch,
      })
      if (!okRejectedUpdate) {
        setResponseStatus(event, 500)
        return { ok: false, error: 'subscription_update_failed' }
      }

      if (llegoAlLimite) {
        // Cancelar en MP (best-effort: si falla, marcamos local igual y
        // dependemos de que MP eventualmente nos avise vía preapproval webhook)
        await cancelarPreapprovalMercadoPago(pay.preapproval_id, MP_ACCESS_TOKEN)
          .catch(err => console.error('[webhook] cancel MP after failed payments:', err))

        // Downgrade a Free
        const okDowngrade = await asignarPlanUsuario({
          supabaseUrl:    SUPABASE_URL,
          serviceRoleKey: SUPABASE_SERVICE_KEY,
          userId:         sub.user_id,
          plan:           'free' as Plan,
        })
        if (!okDowngrade) {
          setResponseStatus(event, 500)
          return { ok: false, error: 'plan_downgrade_failed' }
        }
      }

      procesoExitoso = true; return { ok: true, processed: true, action: 'payment_rejected', failed: fallidos, downgraded: llegoAlLimite }
    }

    procesoExitoso = true; return { ok: true, status: pay.status, processed: false }
  }

  // ── PAYMENT: pago aprobado ────────────────────────────────────────────────
  // Cubre dos casos:
  //   (a) Pago único legacy (create-preference) — sin sub asociada, solo asigna plan.
  //   (b) Cobro de un preapproval cuando MP NO envía `subscription_preapproval`.
  //       Observado en producción MP Chile 2026-05: el panel acepta el topic
  //       "Planes y suscripciones" pero no dispara los eventos; el único signal
  //       que llega es `type=payment`. Sin esta rama, la fila en subscriptions
  //       queda en `pending` para siempre (rompe cancelación, dashboard, crons).
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

    // Sincronizar subscriptions: buscar la sub activa (pending o authorized) del
    // user+plan y reflejar el cobro. Si no hay sub local, es pago legacy y no
    // hacemos nada — solo el asignarPlanUsuario aplica. Idempotente si después
    // llega `subscription_preapproval authorized` (mismo UPDATE).
    const subsUrl = `${SUPABASE_URL}/rest/v1/subscriptions` +
      `?user_id=eq.${encodeURIComponent(userId)}` +
      `&plan=eq.${encodeURIComponent(plan)}` +
      `&status=in.(pending,authorized)` +
      `&select=id,status` +
      `&order=created_at.desc&limit=1`
    const subsRes = await fetch(subsUrl, {
      headers: {
        apikey:        SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    })
    const subs = subsRes.ok
      ? await subsRes.json() as Array<{ id: string; status: string }>
      : []
    const localSub = subs[0]

    let subUpdated = false
    if (localSub) {
      const fechaPago = pago.date_approved ?? pago.date_created ?? new Date().toISOString()
      const necesitaActivar = localSub.status !== 'authorized'
      const patch: Record<string, unknown> = {
        last_payment_at: fechaPago,
        failed_payments: 0,
      }
      if (necesitaActivar) {
        patch.status     = 'authorized'
        patch.started_at = fechaPago
      }

      const updateRes = await fetch(
        `${SUPABASE_URL}/rest/v1/subscriptions?id=eq.${encodeURIComponent(localSub.id)}`,
        {
          method:  'PATCH',
          headers: {
            apikey:         SUPABASE_SERVICE_KEY,
            Authorization:  `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            Prefer:         'return=minimal',
          },
          body: JSON.stringify(patch),
        },
      )
      if (updateRes.ok) {
        subUpdated = true
      } else {
        // Best-effort: el plan ya está asignado, no bloqueamos por esto.
        // Log para diagnosticar drift entre profiles.plan y subscriptions.
        console.error('[webhook] payment sub update failed:', await updateRes.text())
      }
    }

    procesoExitoso = true
    return { ok: true, processed: true, type: 'payment', userId, plan, sub_updated: subUpdated }
  }

  // Ignorar cualquier otro tipo (merchant_order, plans, etc.)
  procesoExitoso = true
  return { ok: true, ignored: true, type }

  } catch (err) {
    // Log con contexto antes de propagar (Nitro responde 500). Sin esto
    // perderíamos type/eventId/dataId al diagnosticar fallos en producción.
    console.error('[webhook] handler error:', { type, eventId, dataId, err })
    throw err
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
