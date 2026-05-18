// Backfill one-shot: pagina /v1/payments/search de MP y upserta cada pago en
// public.payments. Idempotente (UNIQUE en mp_payment_id + Prefer: merge-duplicates).
//
// Se diseñó para correr una sola vez tras instalar las tablas payments+plan_changes,
// pero se puede ejecutar de nuevo sin riesgo — los pagos existentes se actualizan
// con los datos más recientes de MP (fee_details, status, money_release_date).
//
// Protegido por rol admin. POST a /api/admin/backfill-payments sin body.
//
// Variables de entorno:
//   MP_ACCESS_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_KEY

import { persistirPagoMercadoPago } from '~~/server/utils/mercadopago'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

const PAGE_SIZE   = 50
const MAX_PAGES   = 40  // tope defensivo: 2000 pagos máximo por ejecución

export default defineEventHandler(async (event) => {
  const MP_ACCESS_TOKEN      = process.env.MP_ACCESS_TOKEN
  const SUPABASE_URL         = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

  if (!MP_ACCESS_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    setResponseStatus(event, 503)
    return { ok: false, error: 'mercadopago_not_configured' }
  }

  // Auth + role admin
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

  let offset = 0
  let totalFetched = 0
  let totalUpserted = 0
  let totalFailed = 0
  let pagesProcessed = 0
  const errors: Array<{ paymentId: string; msg: string }> = []

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL('https://api.mercadopago.com/v1/payments/search')
    url.searchParams.set('sort', 'date_created')
    url.searchParams.set('criteria', 'desc')
    url.searchParams.set('limit', String(PAGE_SIZE))
    url.searchParams.set('offset', String(offset))

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      console.error('[backfill] MP search failed:', res.status, txt)
      setResponseStatus(event, 502)
      return {
        ok: false,
        error: 'mp_search_failed',
        mp_status: res.status,
        pages_processed: pagesProcessed,
        upserted: totalUpserted,
      }
    }

    const body = await res.json() as {
      paging?: { total: number; limit: number; offset: number }
      results?: Array<{
        id:                 number
        status:             string
        status_detail?:     string
        external_reference?: string
        transaction_amount: number
        date_approved?:     string
        money_release_date?: string
        fee_details?:       Array<{ type: string; amount: number; fee_payer?: string }>
        transaction_details?: { net_received_amount?: number }
        // Para pagos asociados a preapproval, MP devuelve estos campos
        // (no documentados en search pero presentes en /v1/payments/{id}).
        // Si no vienen en search, los pagos quedan sin preapproval_id —
        // se puede enriquecer haciendo GET por id, pero implica N requests.
      }>
    }

    const results = body.results ?? []
    if (results.length === 0) break

    for (const pago of results) {
      // external_reference formato esperado: "user_id:plan"
      const userId = pago.external_reference?.split(':')[0] ?? null
      const isUuid = !!userId && /^[0-9a-f-]{36}$/i.test(userId)

      const ok = await persistirPagoMercadoPago({
        supabaseUrl:    SUPABASE_URL,
        serviceRoleKey: SUPABASE_SERVICE_KEY,
        pago,
        userId:         isUuid ? userId : null,
        preapprovalId:  null,  // search no devuelve preapproval_id; queda null
      })
      totalFetched++
      if (ok) {
        totalUpserted++
      } else {
        totalFailed++
        errors.push({ paymentId: String(pago.id), msg: 'persist_failed' })
      }
    }

    pagesProcessed++
    offset += PAGE_SIZE
    if (results.length < PAGE_SIZE) break
  }

  return {
    ok:              true,
    pages_processed: pagesProcessed,
    fetched:         totalFetched,
    upserted:        totalUpserted,
    failed:          totalFailed,
    errors:          errors.slice(0, 10),  // primeros 10 errores
  }
})
