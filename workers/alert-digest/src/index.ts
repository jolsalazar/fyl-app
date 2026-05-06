interface Env {
  SUPABASE_URL:        string
  SUPABASE_SERVICE_KEY: string
  RESEND_API_KEY:      string
  CRON_SECRET:         string
  APP_URL:             string
}

const MONTO_ORDER = ['hasta_1M', '1M_10M', '10M_30M', '30M_60M', '60M_100M', 'sobre_100M']
const MONTO_LABELS: Record<string, string> = {
  hasta_1M: 'Hasta $1M', '1M_10M': '$1M–$10M', '10M_30M': '$10M–$30M',
  '30M_60M': '$30M–$60M', '60M_100M': '$60M–$100M', sobre_100M: 'Más de $100M',
}
const FUENTE_LABELS: Record<string, string> = {
  corfo: 'CORFO', sercotec: 'SERCOTEC', anid: 'ANID',
  mercadopublico: 'Mercado Público', fondos_gob: 'Fondos.gob.cl',
  incubadoras: 'Incubadoras',
}

export default {
  // ── Cron trigger ─────────────────────────────────────────────────
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runDigest(env))
  },

  // ── HTTP (prueba manual) ──────────────────────────────────────────
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.headers.get('Authorization') !== `Bearer ${env.CRON_SECRET}`) {
      return new Response('Unauthorized', { status: 401 })
    }
    const result = await runDigest(env)
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    })
  },
}

// ── Lógica principal ──────────────────────────────────────────────
async function runDigest(env: Env) {
  const log: string[] = []

  // 1. Usuarios Pro / Agencia
  const profiles = await sbGet<{ id: string }[]>(
    env, '/rest/v1/profiles?plan=in.(starter,pro,agencia)&select=id'
  )
  if (!profiles?.length) return { ok: true, message: 'No pro users' }

  log.push(`Usuarios Pro: ${profiles.length}`)
  let totalEmails = 0

  for (const profile of profiles) {
    const sent = await processUser(env, profile.id, log)
    if (sent) totalEmails++
  }

  log.push(`Emails enviados: ${totalEmails}`)
  return { ok: true, log }
}

// ── Procesar un usuario ───────────────────────────────────────────
async function processUser(env: Env, userId: string, log: string[]): Promise<boolean> {
  // Email via admin API
  const authUser = await sbAdminGet<{ email: string }>(env, `/auth/v1/admin/users/${userId}`)
  if (!authUser?.email) return false

  // Alertas activas
  const alertas = await sbGet<any[]>(
    env, `/rest/v1/alert_configs?user_id=eq.${userId}&activo=eq.true&select=*`
  )
  if (!alertas?.length) return false

  // IDs donde ya postulé — no notificar
  const postulaciones = await sbGet<{ convocatoria_id: string }[]>(
    env, `/rest/v1/postulaciones?user_id=eq.${userId}&select=convocatoria_id`
  ) ?? []
  const idsPostulados = postulaciones.map(p => p.convocatoria_id)

  const ahora      = new Date().toISOString()
  const resultados: Array<{ alerta: any; items: any[] }> = []

  for (const alerta of alertas) {
    const desde = alerta.last_notified_at
      ? new Date(alerta.last_notified_at)
      : new Date(Date.now() - 25 * 60 * 60 * 1000)

    const items = await fetchMatches(env, alerta, desde, idsPostulados)

    if (items.length > 0) {
      resultados.push({ alerta, items })
      log.push(`  ${authUser.email} | "${alerta.nombre}": ${items.length} nuevas`)
    }

    // Marcar como notificado siempre (evita re-envío)
    await sbPatch(env, `/rest/v1/alert_configs?id=eq.${alerta.id}`, { last_notified_at: ahora })
  }

  if (!resultados.length) return false

  const total = resultados.reduce((s, r) => s + r.items.length, 0)
  await sendEmail(env, authUser.email, total, resultados)
  return true
}

// ── Matching query ────────────────────────────────────────────────
async function fetchMatches(env: Env, alerta: any, desde: Date, idsPostulados: string[] = []) {
  const foco     = (alerta.foco ?? []) as string[]
  const keywords = (alerta.palabras_clave ?? []) as string[]

  const params = new URLSearchParams()
  params.set('estado',         'eq.abierto')
  params.set('fecha_scrapeado', `gt.${desde.toISOString()}`)
  params.set('select',          'id,titulo,fuente,tipo,monto_rango,fecha_cierre_postulacion,link_postulacion,descripcion_breve,foco')
  params.set('order',           'fecha_scrapeado.desc')
  params.set('limit',           '5')

  if (alerta.tipos?.length)           params.set('tipo',    `in.(${alerta.tipos.join(',')})`)
  if (alerta.fuentes?.length)         params.set('fuente',  `in.(${alerta.fuentes.join(',')})`)
  if (alerta.alcance_interes?.length) params.set('alcance', `in.(${alerta.alcance_interes.join(',')})`)

  if (alerta.monto_rangos?.length) {
    params.set('monto_rango', `in.(${alerta.monto_rangos.join(',')})`)
  } else if (alerta.monto_minimo) {
    const idx = MONTO_ORDER.indexOf(alerta.monto_minimo)
    if (idx >= 0) params.set('monto_rango', `in.(${MONTO_ORDER.slice(idx).join(',')})`)
  }

  // foco overlap — PostgREST usa cs (contains) para arrays
  if (foco.length) params.set('foco', `cs.{${foco.join(',')}}`)

  // keywords — OR en título y descripción
  if (keywords.length) {
    const or = keywords.flatMap(k => [
      `titulo.ilike.*${k}*`,
      `descripcion_breve.ilike.*${k}*`,
    ]).join(',')
    params.set('or', `(${or})`)
  }

  // Excluir fondos donde el usuario ya postuló
  if (idsPostulados.length)
    params.set('id', `not.in.(${idsPostulados.join(',')})`)

  const data = await sbGet<any[]>(env, `/rest/v1/convocatorias?${params.toString()}`)
  return data ?? []
}

// ── Enviar email ──────────────────────────────────────────────────
async function sendEmail(
  env: Env,
  to: string,
  total: number,
  resultados: Array<{ alerta: any; items: any[] }>
) {
  const plural = total !== 1
  await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    'Fondos y Licitaciones <alertas@fondosylicitaciones.cl>',
      to:      [to],
      subject: `${total} nueva${plural ? 's' : ''} oportunidad${plural ? 'es' : ''} para ti`,
      html:    buildEmail(env, to, total, resultados),
    }),
  })
}

// ── HTML del email ────────────────────────────────────────────────
function buildEmail(
  env: Env,
  email: string,
  total: number,
  resultados: Array<{ alerta: any; items: any[] }>
): string {
  const plural    = total !== 1
  const secciones = resultados.map(r => buildSeccion(env, r.alerta, r.items)).join('')

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <tr><td style="background:#0f172a;border-radius:16px 16px 0 0;padding:28px 36px;">
    <img src="https://app.fondosylicitaciones.cl/logo-dark.png" alt="Fondos y Licitaciones" height="36" style="display:block;border:0;" />
  </td></tr>

  <tr><td style="background:white;padding:36px 36px 28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0f172a;letter-spacing:-0.025em;">
      ${total} nueva${plural ? 's' : ''} oportunidad${plural ? 'es' : ''} para ti
    </h1>
    <p style="margin:0 0 28px;font-size:15px;color:#64748b;line-height:1.6;">
      ${plural ? 'Estas convocatorias abrieron' : 'Esta convocatoria abrió'} desde tu última notificación y coincide${plural ? 'n' : ''} con tus alertas.
    </p>

    ${secciones}

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;padding-top:28px;border-top:1px solid #f1f5f9;">
      <tr><td align="center">
        <a href="${env.APP_URL}/dashboard/alertas"
           style="display:inline-block;background:#0ea5e9;color:white;font-size:15px;font-weight:700;text-decoration:none;padding:13px 32px;border-radius:11px;">
          Ver todas en el dashboard →
        </a>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;padding:20px 36px;">
    <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;line-height:1.6;">
      Recibiste este email como usuario Plan Pro en <strong>${esc(email)}</strong>.<br/>
      <a href="${env.APP_URL}/dashboard/alertas" style="color:#94a3b8;text-decoration:underline;">Gestionar alertas</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

function buildSeccion(env: Env, alerta: any, items: any[]): string {
  const cards  = items.map(item => buildCard(env, item, alerta)).join('<tr><td height="8"></td></tr>')
  const hayMas = items.length >= 5

  return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
  <tr><td style="padding-bottom:10px;">
    <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#94a3b8;">
      🔔 &nbsp;${esc(alerta.nombre ?? 'Mi alerta')}
    </span>
  </td></tr>
  ${cards}
  ${hayMas ? `
  <tr><td height="8"></td></tr>
  <tr><td style="text-align:center;">
    <a href="${env.APP_URL}/dashboard/alertas" style="font-size:13px;color:#0ea5e9;text-decoration:none;font-weight:600;">
      Ver todas las coincidencias →
    </a>
  </td></tr>` : ''}
</table>`
}

function buildCard(env: Env, item: any, alerta: any): string {
  const fuente = FUENTE_LABELS[item.fuente] ?? item.fuente ?? ''
  const monto  = item.monto_rango ? (MONTO_LABELS[item.monto_rango] ?? '') : ''
  const cierre = item.fecha_cierre_postulacion
    ? `Cierra ${new Date(item.fecha_cierre_postulacion).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : ''
  const alertaId = alerta.id ?? ''
  const detalle  = `${env.APP_URL}/r?to=${encodeURIComponent(`/dashboard/oportunidades/${item.id}`)}&conv=${item.id}&alerta=${alertaId}`
  const link     = item.link_postulacion || detalle
  const focos  = ((item.foco ?? []) as string[]).slice(0, 3).join(' · ')
  const tipoBadge = item.tipo === 'fondo'
    ? '<span style="font-size:10px;font-weight:600;background:#f0fdf4;color:#16a34a;padding:2px 7px;border-radius:999px;margin-left:6px;">Fondo</span>'
    : '<span style="font-size:10px;font-weight:600;background:#eef2ff;color:#4338ca;padding:2px 7px;border-radius:999px;margin-left:6px;">Licitación</span>'

  return `
<tr><td style="border:1px solid #e2e8f0;border-radius:11px;padding:16px 20px;background:white;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td>
      <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#0ea5e9;">${esc(fuente)}</span>
      ${tipoBadge}
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
          ${item.link_postulacion ? `
          <a href="${link}" style="display:inline-block;background:#0ea5e9;color:white;font-size:12px;font-weight:700;text-decoration:none;padding:7px 16px;border-radius:8px;margin-left:6px;">
            Postular →
          </a>` : ''}
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

async function sbPatch(env: Env, path: string, body: object) {
  await fetch(`${env.SUPABASE_URL}${path}`, {
    method:  'PATCH',
    headers: { ...sbHeaders(env), 'Prefer': 'return=minimal' },
    body:    JSON.stringify(body),
  })
}

// ── Utilidades ────────────────────────────────────────────────────
function esc(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n).trimEnd() + '…' : s
}
