// Cron diario: envía email de aviso "tu promo termina en X días" a suscripciones
// que están a 10 o menos días del cambio promo→regular y aún no recibieron aviso.
//
// Auth: header `x-cron-secret` debe coincidir con env CRON_SECRET.
// Idempotencia: el WHERE filtra `aviso_promo_enviado_at IS NULL`. Marcamos el
// timestamp solo después de enviar exitosamente, así si el email falla se
// reintenta el día siguiente.
//
// Variables de entorno requeridas:
//   CRON_SECRET           Secreto compartido para autenticar el cron
//   SUPABASE_URL          Para queries
//   SUPABASE_SERVICE_KEY  Bypass RLS
//   RESEND_API_KEY        Para enviar el email

import { PLANES_CONFIG, esPlanValido, type Plan } from '~~/utils/planes'
import { emailAvisoPromo, enviarEmail } from '~~/server/utils/email'

type Subscription = {
  id:             string
  user_id:        string
  plan:           Plan
  regular_amount: number
  promo_ends_at:  string
}

const DIAS_AVISO = 10  // enviar aviso N días antes del cambio

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

  // Suscripciones cuyo promo termina en los próximos DIAS_AVISO días y aún
  // no recibieron aviso. Excluye también las que ya pasaron promo_ends_at
  // (esas las maneja aplicar-cambio-promo).
  const ahora = new Date()
  const limiteSup = new Date(ahora.getTime() + DIAS_AVISO * 24 * 60 * 60 * 1000)

  const queryUrl = `${SUPABASE_URL}/rest/v1/subscriptions` +
    `?status=eq.authorized` +
    `&promo_applied=eq.false` +
    `&aviso_promo_enviado_at=is.null` +
    `&promo_ends_at=gte.${encodeURIComponent(ahora.toISOString())}` +
    `&promo_ends_at=lte.${encodeURIComponent(limiteSup.toISOString())}` +
    `&select=id,user_id,plan,regular_amount,promo_ends_at`

  const queryRes = await fetch(queryUrl, {
    headers: {
      apikey:        SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  })
  if (!queryRes.ok) {
    setResponseStatus(event, 500)
    return { ok: false, error: 'query_failed' }
  }

  const subs = await queryRes.json() as Subscription[]
  const resultados: Array<{ id: string; ok: boolean; error?: string }> = []

  for (const sub of subs) {
    if (!esPlanValido(sub.plan)) {
      resultados.push({ id: sub.id, ok: false, error: 'invalid_plan' })
      continue
    }

    // Obtener email del usuario
    const userRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users/${sub.user_id}`,
      {
        headers: {
          apikey:        SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      },
    )
    const userData = userRes.ok ? await userRes.json() as { email?: string } : null
    if (!userData?.email) {
      resultados.push({ id: sub.id, ok: false, error: 'user_email_not_found' })
      continue
    }

    const fechaCambio   = new Date(sub.promo_ends_at)
    const diasRestantes = Math.max(1, Math.ceil((fechaCambio.getTime() - ahora.getTime()) / (24 * 60 * 60 * 1000)))
    const fechaFmt      = fechaCambio.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })

    const tpl = emailAvisoPromo({
      nombrePlan:    PLANES_CONFIG[sub.plan].nombre,
      precioRegular: sub.regular_amount,
      diasRestantes,
      fechaCambio:   fechaFmt,
    })

    const enviado = await enviarEmail({ to: userData.email, ...tpl })
    if (!enviado) {
      resultados.push({ id: sub.id, ok: false, error: 'email_failed' })
      continue
    }

    // Marcar como enviado solo después del envío exitoso (reintenta si falla)
    const updateRes = await fetch(
      `${SUPABASE_URL}/rest/v1/subscriptions?id=eq.${sub.id}`,
      {
        method:  'PATCH',
        headers: {
          apikey:         SUPABASE_SERVICE_KEY,
          Authorization:  `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer:         'return=minimal',
        },
        body: JSON.stringify({ aviso_promo_enviado_at: ahora.toISOString() }),
      },
    )
    if (!updateRes.ok) {
      console.error(`[cron-aviso] UPDATE timestamp falló para ${sub.id}`)
      // El email se envió pero no se marcó. Próxima ejecución reintentará.
    }

    resultados.push({ id: sub.id, ok: true })
  }

  return {
    ok:        true,
    procesados: resultados.length,
    exitosos:   resultados.filter(r => r.ok).length,
    errores:    resultados.filter(r => !r.ok).length,
    detalle:    resultados,
  }
})
