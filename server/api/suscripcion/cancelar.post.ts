// Cancela la suscripción activa del usuario logueado:
// 1. Lee la subscription en authorized del usuario
// 2. PUT a MP /preapproval/{id} para cancelar (deja de cobrar mensualmente)
// 3. UPDATE subscription local: status=cancelled, cancelled_at=now()
// 4. Downgrade plan del usuario a 'free' inmediatamente
//
// El webhook eventualmente recibirá preapproval con status=cancelled — la
// operación local ya idempotente, así que no se dispara nada nuevo.
//
// Variables de entorno requeridas:
//   MP_ACCESS_TOKEN
//   SUPABASE_URL
//   SUPABASE_SERVICE_KEY  (downgrade requiere admin_set_user_plan via service_role)

import { asignarPlanUsuario, cancelarPreapprovalMercadoPago } from '~~/server/utils/mercadopago'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const MP_ACCESS_TOKEN      = process.env.MP_ACCESS_TOKEN
  const SUPABASE_URL         = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

  if (!MP_ACCESS_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    setResponseStatus(event, 503)
    return { ok: false, error: 'mercadopago_not_configured' }
  }

  const user = await serverSupabaseUser(event)
  if (!user) {
    setResponseStatus(event, 401)
    return { ok: false, error: 'unauthorized' }
  }

  // Buscar suscripción activa del usuario (RLS aplica)
  const supabase = await serverSupabaseClient(event)
  const { data: sub, error: subErr } = await supabase
    .from('subscriptions')
    .select('id, mp_preapproval_id, status')
    .eq('user_id', user.id)
    .eq('status', 'authorized')
    .maybeSingle()

  if (subErr) {
    setResponseStatus(event, 500)
    return { ok: false, error: 'query_failed' }
  }
  if (!sub) {
    setResponseStatus(event, 404)
    return { ok: false, error: 'no_active_subscription' }
  }

  // Cancelar en MercadoPago
  const mpRes = await cancelarPreapprovalMercadoPago(sub.mp_preapproval_id, MP_ACCESS_TOKEN)
  if (!mpRes.ok) {
    console.error('[cancelar] MP rechazó cancelar:', mpRes.status, mpRes.body)
    setResponseStatus(event, 502)
    return { ok: false, error: 'mp_cancel_failed' }
  }

  // Marcar local cancelled (RPC respeta RLS, solo cancela suscripción propia)
  const { error: rpcErr } = await supabase.rpc('cancelar_suscripcion_propia')
  if (rpcErr) {
    console.error('[cancelar] rpc fallo:', rpcErr)
    // Continuamos: ya cancelamos en MP, no hay vuelta atrás. El webhook
    // o el cron de reconciliación pueden corregir el estado local.
  }

  // Downgrade plan del usuario a free (admin_set_user_plan vía service_role)
  await asignarPlanUsuario({
    supabaseUrl:    SUPABASE_URL,
    serviceRoleKey: SUPABASE_SERVICE_KEY,
    userId:         user.id,
    plan:           'free',
    source:         'cancel',
  })

  return { ok: true }
})
