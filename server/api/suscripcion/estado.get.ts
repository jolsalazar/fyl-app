// Devuelve la suscripción activa o más reciente del usuario logueado.
// Usado por la página /dashboard/suscripcion para mostrar plan actual,
// próximo cobro, estado de promo, etc.
//
// La sesión se valida server-side. La consulta usa serverSupabaseClient
// que respeta RLS (el usuario solo ve sus propias suscripciones).

import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    setResponseStatus(event, 401)
    return { ok: false, error: 'unauthorized' }
  }

  const supabase = await serverSupabaseClient(event)
  const { data, error } = await supabase
    .from('subscriptions')
    .select('id, plan, status, current_amount, regular_amount, promo_applied, promo_ends_at, started_at, last_payment_at, cancelled_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    setResponseStatus(event, 500)
    return { ok: false, error: 'query_failed' }
  }

  return { ok: true, suscripcion: data ?? null }
})
