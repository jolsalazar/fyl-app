// Webhook de MercadoPago: recibe notificaciones de pago, valida firma, consulta el
// pago en la API de MP, y si está aprobado asigna el plan al usuario.
//
// Variables de entorno requeridas (configurar en el deploy antes de activar el flujo):
//   MP_WEBHOOK_SECRET    Secret de firma del webhook (panel MP > Webhooks > "Configurar")
//   MP_ACCESS_TOKEN      Access token del vendedor (panel MP > Credenciales)
//   SUPABASE_URL         Ya existente
//   SUPABASE_SERVICE_KEY Service role key de Supabase (NO la anon key)
//
// Convención de external_reference: "<user_id>:<plan>" (ej: "abc-123-...:starter").
// El frontend genera este string al crear la preferencia (ver create-preference.post.ts).
//
// Importante: este endpoint está LISTO pero no activo en producción hasta que existan las
// credenciales y el flujo de checkout esté armado. Si faltan envs responde 503.

import {
  asignarPlanUsuario,
  esPlanValido,
  obtenerPagoMercadoPago,
  verificarFirmaMercadoPago,
} from '~~/server/utils/mercadopago'

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

  // MP a veces manda notificaciones que no son de pago (merchant_order, etc.) — ignorar.
  if (body.type !== 'payment' || !dataId) {
    return { ok: true, ignored: true }
  }

  const headers   = getRequestHeaders(event)
  const firmaOk   = await verificarFirmaMercadoPago({
    signatureHeader: headers['x-signature'],
    requestId:       headers['x-request-id'],
    dataId,
    secret:          MP_WEBHOOK_SECRET,
  })
  if (!firmaOk) {
    setResponseStatus(event, 401)
    return { ok: false, error: 'invalid_signature' }
  }

  const pago = await obtenerPagoMercadoPago(dataId, MP_ACCESS_TOKEN)
  if (!pago) {
    setResponseStatus(event, 502)
    return { ok: false, error: 'payment_fetch_failed' }
  }

  // Solo procesamos pagos efectivamente acreditados.
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
    plan,
  })
  if (!asignado) {
    setResponseStatus(event, 500)
    return { ok: false, error: 'rpc_failed' }
  }

  return { ok: true, processed: true, userId, plan }
})
