// Guarda la intención de contratación de plan del usuario en profiles.intended_plan.
// Esto se usa para que al final del onboarding, si el usuario llegó eligiendo un plan
// pago desde la web, lo redirijamos automáticamente al checkout de MercadoPago.
//
// La sesión se valida del lado del servidor — no se confía en el body del request.
// Usa serverSupabaseClient para que el UPDATE pase RLS con la identidad del usuario.

import { esPlanValido } from '~~/utils/planes'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    setResponseStatus(event, 401)
    return { ok: false, error: 'unauthorized' }
  }

  const body = await readBody<{ plan?: string | null }>(event) ?? {}
  const plan = body.plan

  // Permitir null para limpiar la intención (ej: pago confirmado, cancelar plan)
  if (plan !== null && !esPlanValido(plan)) {
    setResponseStatus(event, 400)
    return { ok: false, error: 'invalid_plan' }
  }

  // 'free' no es una intención válida (no requiere pago)
  if (plan === 'free') {
    setResponseStatus(event, 400)
    return { ok: false, error: 'invalid_plan' }
  }

  const supabase = await serverSupabaseClient(event)
  const { error } = await supabase
    .from('profiles')
    .update({ intended_plan: plan })
    .eq('id', user.id)

  if (error) {
    setResponseStatus(event, 500)
    return { ok: false, error: 'update_failed' }
  }

  return { ok: true }
})
