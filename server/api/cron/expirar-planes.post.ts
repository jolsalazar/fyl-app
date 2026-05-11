// Cron diario: baja a Free planes mensuales no recurrentes cuyo periodo venció.
//
// Auth: header `x-cron-secret` debe coincidir con env CRON_SECRET.

export default defineEventHandler(async (event) => {
  const CRON_SECRET          = process.env.CRON_SECRET
  const SUPABASE_URL         = process.env.SUPABASE_URL
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

  if (!CRON_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    setResponseStatus(event, 503)
    return { ok: false, error: 'cron_not_configured' }
  }

  const headers = getRequestHeaders(event)
  if (headers['x-cron-secret'] !== CRON_SECRET) {
    setResponseStatus(event, 401)
    return { ok: false, error: 'unauthorized' }
  }

  const nowIso = new Date().toISOString()
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?plan=neq.free&plan_expires_at=lte.${encodeURIComponent(nowIso)}`,
    {
      method:  'PATCH',
      headers: {
        apikey:         SUPABASE_SERVICE_KEY,
        Authorization:  `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer:         'return=representation',
      },
      body: JSON.stringify({
        plan:            'free',
        plan_status:     'cancelled',
        plan_expires_at: null,
      }),
    },
  )

  if (!res.ok) {
    setResponseStatus(event, 500)
    return { ok: false, error: 'expire_failed', detail: await res.text().catch(() => '') }
  }

  const actualizados = await res.json().catch(() => []) as unknown[]
  return { ok: true, actualizados: actualizados.length }
})
