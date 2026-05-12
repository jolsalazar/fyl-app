// Devuelve la suscripción más relevante del usuario logueado:
// - Si hay activa(s) (status pending/authorized): la más reciente
// - Si no hay activas: la última cancelada (para mostrar historial)
//
// Devuelve también `multiple_activas` para que la UI alerte si hay > 1
// (esto NO debería pasar gracias al unique partial index, pero defensa
// en profundidad por si hay datos históricos inconsistentes).
//
// Para suscripciones authorized, intenta consultar a MercadoPago el
// `next_payment_date` real. Si falla (timeout, MP caído), no bloquea —
// el frontend cae al estimado local.

import { obtenerPreapprovalMercadoPago } from '~~/server/utils/mercadopago'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user) {
    setResponseStatus(event, 401)
    return { ok: false, error: 'unauthorized' }
  }

  const supabase = await serverSupabaseClient(event)
  const { data: subs, error } = await supabase
    .from('subscriptions')
    .select('id, plan, status, mp_preapproval_id, current_amount, regular_amount, promo_applied, promo_ends_at, started_at, last_payment_at, cancelled_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    setResponseStatus(event, 500)
    return { ok: false, error: 'query_failed' }
  }

  const lista   = subs ?? []
  const activas = lista.filter(s => s.status === 'authorized' || s.status === 'pending')
  const principal = activas[0] ?? lista[0] ?? null

  // Para sub authorized: intentar enriquecer con next_payment_date real de MP
  let nextPaymentDate: string | null = null
  if (principal?.status === 'authorized' && process.env.MP_ACCESS_TOKEN) {
    const mpSub = await obtenerPreapprovalMercadoPago(
      principal.mp_preapproval_id,
      process.env.MP_ACCESS_TOKEN,
    ).catch(() => null)
    nextPaymentDate = mpSub?.next_payment_date ?? null
  }

  return {
    ok:                true,
    suscripcion:       principal,
    multiple_activas:  activas.length > 1,
    next_payment_date: nextPaymentDate,
  }
})
