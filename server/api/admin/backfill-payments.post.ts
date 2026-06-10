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

import { mapearFilaPago, persistirPagosMercadoPago, type PagoMercadoPago } from '~~/server/utils/mercadopago'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'

const PAGE_SIZE   = 50
// Cloudflare Workers limita las subrequests por invocación (~50 en plan free).
// Cada página consume 2 (search MP + upsert masivo), más ~3 del auth inicial:
// 20 páginas ≈ 43 subrequests, dentro del límite. Tope: 1000 pagos por ejecución.
const MAX_PAGES   = 20

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
      // Si MP no devuelve preapproval_id en search, los pagos quedan sin él —
      // se puede enriquecer haciendo GET por id, pero implica N requests.
      results?: PagoMercadoPago[]
    }

    const results = body.results ?? []
    if (results.length === 0) break

    const rows = results.map((pago) => {
      // external_reference formato esperado: "user_id:plan"
      const userId = pago.external_reference?.split(':')[0] ?? null
      const isUuid = !!userId && /^[0-9a-f-]{36}$/i.test(userId)
      return mapearFilaPago(pago, isUuid ? userId : null, null)
    })

    // Página completa en una sola request (límite de subrequests de Workers).
    const ok = await persistirPagosMercadoPago({
      supabaseUrl:    SUPABASE_URL,
      serviceRoleKey: SUPABASE_SERVICE_KEY,
      rows,
    })
    totalFetched += results.length
    if (ok) {
      totalUpserted += results.length
    } else {
      totalFailed += results.length
      errors.push({ paymentId: `página offset=${offset}`, msg: 'persist_failed' })
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
