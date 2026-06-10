// Reporte MENSUAL para TODOS los usuarios — día 1 de cada mes, 9am Chile.
//
// Es la versión correo del panorama mensual público (/blog/fondos-abiertos/...):
// cuántos fondos y licitaciones hay abiertos este mes, los destacados por monto
// y qué cierra el próximo mes. El contenido es el MISMO para todos (se calcula
// una vez vía el endpoint público cacheado de fyl-app); lo único que varía por
// usuario es el CTA final: free → upsell Mi Match/planes, pagados → revisar
// sus matches del mes.
//
// No toca alertas ni cursores (last_notified_at, alert_notifications): es 100%
// de lectura, igual que el weekly. Convive con el weekly del viernes — son
// contenidos distintos (panorama del mes vs matches de tu alerta).
//
// Modelado sobre workers/weekly-digest (mismos helpers, labels y estilo HTML).

interface Env {
  SUPABASE_URL:         string
  SUPABASE_SERVICE_KEY: string
  RESEND_API_KEY:       string
  CRON_SECRET:          string
  APP_URL:              string
  SITE_URL:             string
}

const MONTO_LABELS: Record<string, string> = {
  hasta_1M: 'Hasta $1M', '1M_10M': '$1M–$10M', '10M_30M': '$10M–$30M',
  '30M_60M': '$30M–$60M', '60M_100M': '$60M–$100M', sobre_100M: 'Más de $100M',
}
const FUENTE_LABELS: Record<string, string> = {
  corfo: 'CORFO', sercotec: 'SERCOTEC', anid: 'ANID',
  mercadopublico: 'Mercado Público', fondos_gob: 'Fondos.gob.cl',
  incubadoras: 'Incubadoras', fondos_cultura: 'Fondos Cultura',
  santander_x: 'Santander X',
}
const MESES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const MAX_CARDS = 4 // tope de tarjetas de destacados en el email

export default {
  // ── Cron trigger ─────────────────────────────────────────────────
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runMonthly(env))
  },

  // ── HTTP (prueba manual) ──────────────────────────────────────────
  // ?audience=admins → envía SOLO a usuarios con rol admin (prueba de cómo llega
  // el correo, sin spamear a todos). Por defecto: la audiencia real (todos).
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.headers.get('Authorization') !== `Bearer ${env.CRON_SECRET}`) {
      return new Response('Unauthorized', { status: 401 })
    }
    const audience = new URL(request.url).searchParams.get('audience') === 'admins'
      ? 'admins' as const
      : 'all' as const
    const result = await runMonthly(env, audience)
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    })
  },
}

type Audience = 'all' | 'admins'

// ── Tipos del endpoint público /api/public/panorama/[mes] ─────────
interface Destacado {
  id: string; slug: string; fuente: string; tipo: string; titulo: string
  descripcion_breve: string | null; monto_rango: string | null
  fecha_cierre_postulacion: string | null; foco: string[]
}
interface Panorama {
  ok: boolean
  mes: string
  mes_label: string
  total: number
  fondos:       { total: number; urgentes_esta_semana: number }
  licitaciones: { total: number; urgentes_esta_semana: number }
  destacados_fondos: Destacado[]
  proximo_mes: { mes_label: string; total_fondos: number; total_licitaciones: number }
  comparativa_mes_anterior: { total: number; diferencia: number; porcentaje: number } | null
}

// ── Lógica principal ──────────────────────────────────────────────
async function runMonthly(env: Env, audience: Audience = 'all') {
  const log: string[] = []

  // Mes en curso (el cron corre el día 1: reporta el mes que empieza).
  const hoy = new Date()
  const mesParam = `${hoy.getUTCFullYear()}-${String(hoy.getUTCMonth() + 1).padStart(2, '0')}`

  // El contenido es igual para todos: una sola llamada al endpoint público
  // (cacheado 6h en edge) en vez de repetir las consultas acá.
  const res = await fetch(`${env.APP_URL}/api/public/panorama/${mesParam}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    log.push(`Panorama HTTP ${res.status} — abortando`)
    return { ok: false, error: 'panorama_fetch_failed', log }
  }
  const panorama = await res.json<Panorama>()
  if (!panorama.ok || panorama.total === 0) {
    log.push(`Panorama sin datos para ${mesParam} (total=${panorama.total ?? '?'}) — no se envía`)
    return { ok: true, message: 'no_data', log }
  }
  log.push(`Panorama ${panorama.mes_label}: ${panorama.fondos.total} fondos / ${panorama.licitaciones.total} licitaciones`)

  // URL del reporte completo en la web pública: /blog/fondos-abiertos/junio-2026/
  const [anioStr, mesStr] = mesParam.split('-')
  const blogUrl = `${env.SITE_URL}/blog/fondos-abiertos/${MESES_ES[parseInt(mesStr, 10) - 1]}-${anioStr}/?utm_source=email&utm_medium=monthly`

  // Audiencia:
  //   · 'all'    (real): todos los planes, no archivados, no internos.
  //   · 'admins' (prueba): solo rol admin — para previsualizar.
  const query = audience === 'admins'
    ? '/rest/v1/profiles?role=eq.admin&archived_at=is.null&select=id,plan,is_internal'
    : '/rest/v1/profiles?archived_at=is.null&select=id,plan,is_internal'
  const profiles = await sbGet<{ id: string; plan: string | null; is_internal: boolean | null }[]>(env, query)
  if (!profiles?.length) return { ok: true, message: `No users for audience=${audience}`, log }

  const destinatarios = audience === 'admins' ? profiles : profiles.filter(p => !p.is_internal)
  log.push(`Audiencia: ${audience} · destinatarios: ${destinatarios.length}`)

  // El HTML solo varía según free/pagado: lo armamos una vez por variante.
  const htmlFree = buildEmail(env, panorama, blogUrl, false)
  const htmlPaid = buildEmail(env, panorama, blogUrl, true)

  const subject = `Panorama de ${panorama.mes_label}: ${panorama.fondos.total} fondos y ${panorama.licitaciones.total} licitaciones abiertas`

  let totalEmails  = 0
  let totalErrores = 0

  // Aislamiento por usuario: un fallo no aborta toda la corrida.
  for (const profile of destinatarios) {
    try {
      const authUser = await sbAdminGet<{ email: string }>(env, `/auth/v1/admin/users/${profile.id}`)
      if (!authUser?.email) continue
      const esPagado = !!profile.plan && profile.plan !== 'free'
      const ok = await sendEmail(env, authUser.email, subject, esPagado ? htmlPaid : htmlFree)
      if (ok) totalEmails++
      else {
        totalErrores++
        log.push(`  ${authUser.email} | envío Resend falló`)
      }
    } catch (e) {
      totalErrores++
      const msg = e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e)
      log.push(`  ⚠️ ERROR procesando user ${profile.id}: ${msg}`)
      console.error(`[monthly] error en user ${profile.id}:`, e)
    }
  }

  log.push(`Emails enviados: ${totalEmails}${totalErrores ? ` · Errores: ${totalErrores}` : ''}`)
  return { ok: true, errores: totalErrores, log }
}

// ── Enviar email ──────────────────────────────────────────────────
async function sendEmail(env: Env, to: string, subject: string, html: string): Promise<boolean> {
  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    'Fondos y Licitaciones <hola@fondosylicitaciones.cl>',
      to:      [to],
      subject,
      html,
    }),
  })
  return res.ok
}

// ── HTML del email ────────────────────────────────────────────────
function buildEmail(env: Env, p: Panorama, blogUrl: string, esPagado: boolean): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <tr><td style="background:#0f172a;border-radius:16px 16px 0 0;padding:28px 36px;">
    <img src="${env.APP_URL}/logo-white.png" alt="Fondos y Licitaciones" height="36" style="display:block;border:0;" />
  </td></tr>

  <tr><td style="background:white;padding:36px 36px 28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0f172a;letter-spacing:-0.025em;">
      El panorama de ${esc(p.mes_label)}
    </h1>
    <p style="margin:0 0 28px;font-size:15px;color:#64748b;line-height:1.6;">
      Esto es todo lo que está abierto este mes en fondos y licitaciones en Chile.
    </p>

    ${buildResumenBlock(p)}
    ${buildDestacadosBlock(env, p)}
    ${buildProximoBlock(p)}
    ${buildReporteBlock(blogUrl)}
    ${esPagado ? buildCtaPagado(env) : buildCtaFree(env)}
  </td></tr>

  <tr><td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;padding:20px 36px;">
    <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;line-height:1.6;">
      Recibes este panorama una vez al mes como usuario de Fondos y Licitaciones.<br/>
      <a href="${env.APP_URL}/dashboard/alertas" style="color:#94a3b8;text-decoration:underline;">Gestionar mis alertas</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

// Bloque 1 — los números del mes.
function buildResumenBlock(p: Panorama): string {
  const cmp = p.comparativa_mes_anterior
  const cmpLinea = cmp && cmp.diferencia !== 0
    ? `<p style="margin:14px 0 0;font-size:13px;color:#64748b;text-align:center;">
        ${cmp.diferencia > 0 ? '📈' : '📉'} ${cmp.diferencia > 0 ? '+' : ''}${cmp.diferencia} (${cmp.diferencia > 0 ? '+' : ''}${cmp.porcentaje}%) vs el mes anterior
      </p>`
    : ''
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;">
  <tr><td style="padding:20px 24px;">
    <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#94a3b8;">📊 &nbsp;Abierto en ${esc(p.mes_label)}</span>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;">
      <tr>
        <td align="center" width="50%" style="padding:6px;">
          <div style="font-size:30px;font-weight:800;color:#16a34a;line-height:1;">${p.fondos.total}</div>
          <div style="font-size:12px;color:#64748b;margin-top:5px;">fondos concursables</div>
        </td>
        <td align="center" width="50%" style="padding:6px;border-left:1px solid #e2e8f0;">
          <div style="font-size:30px;font-weight:800;color:#4338ca;line-height:1;">${p.licitaciones.total}</div>
          <div style="font-size:12px;color:#64748b;margin-top:5px;">licitaciones</div>
        </td>
      </tr>
    </table>
    ${cmpLinea}
  </td></tr>
</table>`
}

// Bloque 2 — fondos destacados del mes (tarjetas).
function buildDestacadosBlock(env: Env, p: Panorama): string {
  const top = (p.destacados_fondos ?? []).slice(0, MAX_CARDS)
  if (!top.length) return ''
  const cards = top.map(item => buildCard(env, item)).join('<tr><td height="8"></td></tr>')
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
  <tr><td style="padding-bottom:8px;">
    <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#16a34a;">🟢 &nbsp;Fondos destacados del mes</span>
  </td></tr>
  ${cards}
</table>`
}

// Bloque 3 — lo que cierra el próximo mes.
function buildProximoBlock(p: Panorama): string {
  const total = (p.proximo_mes?.total_fondos ?? 0) + (p.proximo_mes?.total_licitaciones ?? 0)
  if (!total) return ''
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
  <tr><td style="border:1px solid #e2e8f0;border-radius:11px;padding:16px 20px;background:white;font-size:14px;color:#334155;line-height:1.6;">
    📅 Para <strong>${esc(p.proximo_mes.mes_label)}</strong> ya hay <strong>${p.proximo_mes.total_fondos}</strong> fondo${p.proximo_mes.total_fondos !== 1 ? 's' : ''}
    y <strong>${p.proximo_mes.total_licitaciones}</strong> licitación${p.proximo_mes.total_licitaciones !== 1 ? 'es' : ''} con cierre confirmado.
    El momento de preparar la postulación es ahora.
  </td></tr>
</table>`
}

// Bloque 4 — link al reporte completo en la web.
function buildReporteBlock(blogUrl: string): string {
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
  <tr><td align="center">
    <a href="${blogUrl}" style="font-size:14px;color:#0ea5e9;text-decoration:none;font-weight:600;">Ver el reporte completo del mes →</a>
  </td></tr>
</table>`
}

// CTA free — empuja a Mi Match (la versión personalizada es el valor pagado).
function buildCtaFree(env: Env): string {
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
  <tr><td style="background:#0ea5e9;border-radius:14px;padding:24px 28px;">
    <div style="font-size:17px;font-weight:800;color:white;margin-bottom:6px;">¿Cuáles de estas oportunidades son para ti?</div>
    <p style="margin:0 0 18px;font-size:14px;color:#e0f2fe;line-height:1.6;">
      Con un plan pagado, Mi Match cruza tu perfil con cada convocatoria y te dice
      <strong>exactamente cuáles calzan contigo</strong> — y te avisamos a diario apenas se publican.
    </p>
    <a href="${env.APP_URL}/planes"
       style="display:inline-block;background:white;color:#0369a1;font-size:14px;font-weight:800;text-decoration:none;padding:12px 26px;border-radius:11px;">
      Ver mis matches del mes →
    </a>
  </td></tr>
</table>`
}

// CTA pagado — directo a su match.
function buildCtaPagado(env: Env): string {
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
  <tr><td style="background:#0f172a;border-radius:14px;padding:24px 28px;">
    <div style="font-size:17px;font-weight:800;color:white;margin-bottom:6px;">Tu match con las oportunidades del mes</div>
    <p style="margin:0 0 18px;font-size:14px;color:#cbd5e1;line-height:1.6;">
      Revisa cuáles de estas convocatorias calzan con tu proyecto, ordenadas por compatibilidad.
    </p>
    <a href="${env.APP_URL}/dashboard/match"
       style="display:inline-block;background:white;color:#0f172a;font-size:14px;font-weight:800;text-decoration:none;padding:12px 26px;border-radius:11px;">
      Calcular mi Match →
    </a>
  </td></tr>
</table>`
}

function buildCard(env: Env, item: Destacado): string {
  const fuente = FUENTE_LABELS[item.fuente] ?? item.fuente ?? ''
  const monto  = item.monto_rango ? (MONTO_LABELS[item.monto_rango] ?? '') : ''
  const cierre = item.fecha_cierre_postulacion
    ? `Cierra ${new Date(item.fecha_cierre_postulacion).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : ''
  const detalle = `${env.APP_URL}/r?to=${encodeURIComponent(`/dashboard/oportunidades/${item.id}`)}&conv=${item.id}&monthly=1`
  const focos   = ((item.foco ?? []) as string[]).slice(0, 3).join(' · ')

  return `
<tr><td style="border:1px solid #e2e8f0;border-radius:11px;padding:16px 20px;background:white;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td>
      <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#0ea5e9;">${esc(fuente)}</span>
    </td></tr>
    <tr><td height="6"></td></tr>
    <tr><td style="font-size:15px;font-weight:700;color:#0f172a;line-height:1.35;">${esc(item.titulo ?? '')}</td></tr>
    ${item.descripcion_breve ? `
    <tr><td height="5"></td></tr>
    <tr><td style="font-size:13px;color:#64748b;line-height:1.5;">${esc(truncate(item.descripcion_breve, 140))}</td></tr>` : ''}
    ${focos ? `<tr><td height="6"></td></tr><tr><td style="font-size:11px;color:#94a3b8;">${esc(focos)}</td></tr>` : ''}
    <tr><td height="12"></td></tr>
    <tr><td>
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:12px;color:#94a3b8;vertical-align:middle;">
          ${monto  ? `<span style="margin-right:12px;">💰 ${esc(monto)}</span>`  : ''}
          ${cierre ? `<span>📅 ${esc(cierre)}</span>` : ''}
        </td>
        <td align="right">
          <a href="${detalle}" style="display:inline-block;background:#0f172a;color:white;font-size:12px;font-weight:700;text-decoration:none;padding:7px 16px;border-radius:8px;">
            Ver detalle →
          </a>
        </td>
      </tr></table>
    </td></tr>
  </table>
</td></tr>`
}

// ── Helpers Supabase REST ─────────────────────────────────────────
function sbHeaders(env: Env) {
  return {
    'apikey':        env.SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    'Content-Type':  'application/json',
  }
}

async function sbGet<T>(env: Env, path: string): Promise<T | null> {
  const res = await fetch(`${env.SUPABASE_URL}${path}`, { headers: sbHeaders(env) })
  if (!res.ok) return null
  return res.json()
}

async function sbAdminGet<T>(env: Env, path: string): Promise<T | null> {
  const res = await fetch(`${env.SUPABASE_URL}${path}`, {
    headers: {
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'apikey':        env.SUPABASE_SERVICE_KEY,
    },
  })
  if (!res.ok) return null
  return res.json()
}

// ── Utilidades ────────────────────────────────────────────────────
function esc(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n).trimEnd() + '…' : s
}
