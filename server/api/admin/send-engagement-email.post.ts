// Envía un correo de engagement (plantilla predefinida) a un usuario.
// Solo accesible por admins. POST con body { target_id, template, mode? }.
//
// `mode` (default 'send'):
//   · 'send'    → envía al usuario objetivo (comportamiento original).
//   · 'preview' → devuelve { subject, html } sin enviar nada.
//   · 'test'    → envía al propio admin que hace la petición, con asunto
//                 prefijado "[Prueba]", para ver cómo llega al inbox.
//
// El email del destinatario se obtiene server-side desde auth.users vía
// service role — el cliente nunca envía la dirección, solo el id del usuario.

import { serverSupabaseClient, serverSupabaseUser, serverSupabaseServiceRole } from '#supabase/server'
import { enviarEmail, ENGAGEMENT_TEMPLATES, type EngagementTemplateKey } from '~~/server/utils/email'
import { esPlanValido } from '~~/utils/planes'

export default defineEventHandler(async (event) => {
  // Auth + rol admin (mismo patrón que backfill-payments).
  const user = await serverSupabaseUser(event)
  if (!user) {
    setResponseStatus(event, 401)
    return { ok: false, error: 'unauthorized' }
  }
  const supabase = await serverSupabaseClient(event)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') {
    setResponseStatus(event, 403)
    return { ok: false, error: 'forbidden' }
  }

  const body = await readBody<{ target_id?: string; template?: string; mode?: string }>(event)
  const targetId = body?.target_id
  const templateKey = body?.template as EngagementTemplateKey | undefined
  const mode = body?.mode ?? 'send'

  if (
    !targetId || !templateKey || !(templateKey in ENGAGEMENT_TEMPLATES)
    || !['send', 'preview', 'test'].includes(mode)
  ) {
    setResponseStatus(event, 400)
    return { ok: false, error: 'bad_request' }
  }

  // Obtener email + nombre del destinatario con service role.
  const admin = serverSupabaseServiceRole(event)
  const { data: target, error: userErr } = await admin.auth.admin.getUserById(targetId)
  if (userErr || !target?.user?.email) {
    setResponseStatus(event, 404)
    return { ok: false, error: 'user_not_found' }
  }

  const { data: targetProfile } = await admin
    .from('profiles')
    .select('nombre, intended_plan')
    .eq('id', targetId)
    .single()

  const ip = targetProfile?.intended_plan
  const intendedPlan = esPlanValido(ip) ? ip : null

  // revivir_lead solo tiene sentido si el usuario realmente mostró intención
  // de pago. En preview/test se permite igual (la plantilla cae a 'starter')
  // para que el admin pueda revisarla desde cualquier usuario.
  if (mode === 'send' && templateKey === 'revivir_lead' && !intendedPlan) {
    setResponseStatus(event, 400)
    return { ok: false, error: 'no_intended_plan' }
  }

  const { subject, html } = ENGAGEMENT_TEMPLATES[templateKey].build({
    nombre: targetProfile?.nombre ?? null,
    intendedPlan,
  })

  if (mode === 'preview') {
    return { ok: true, subject, html }
  }

  const to = mode === 'test' ? user.email : target.user.email
  if (!to) {
    setResponseStatus(event, 400)
    return { ok: false, error: 'no_recipient' }
  }
  const sent = await enviarEmail({
    to,
    subject: mode === 'test' ? `[Prueba] ${subject}` : subject,
    html,
  })

  if (!sent) {
    setResponseStatus(event, 502)
    return { ok: false, error: 'send_failed' }
  }

  return { ok: true, to }
})
