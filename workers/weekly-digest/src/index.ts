// Resumen SEMANAL para usuarios FREE — viernes AM.
//
// Contexto: el plan free no recibe el digest diario (eso es beneficio pagado) y
// la gente se registra pero no vuelve. Este correo semanal es la herramienta de
// RE-ENGANCHE + upsell: cada viernes le mostramos (1) qué pasó en general en
// fondos y licitaciones esta semana, (2) qué pasó con SU alerta —o lo invitamos
// a crear una si no tiene— y (3) lo invitamos a pasarse a Pro para recibir las
// oportunidades a diario apenas se publican.
//
// Se envía SIEMPRE (aunque su alerta no tenga match esa semana): saltarse
// semanas mata el propósito de mantener el contacto. Es SOLO LECTURA sobre las
// alertas: NO toca last_notified_at (cursor del digest diario) ni escribe en
// alert_notifications / closing_reminders_sent.
//
// Modelado sobre workers/alert-digest (mismos helpers, labels y estilo HTML).

import { calcularMatch, type Perfil } from '../../../shared/match'

interface Env {
  SUPABASE_URL:         string
  SUPABASE_SERVICE_KEY: string
  RESEND_API_KEY:       string
  CRON_SECRET:          string
  APP_URL:              string
}

const MONTO_ORDER = ['hasta_1M', '1M_10M', '10M_30M', '30M_60M', '60M_100M', 'sobre_100M']
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

const SELECT_CONV = 'id,titulo,fuente,tipo,monto_rango,fecha_cierre_postulacion,link_postulacion,descripcion_breve,foco,alcance,perfil_tipo_persona,perfil_nivel_desarrollo,perfil_antiguedad_empresa,perfil_nivel_ventas'
const SCORE_MIN     = 40
const MAX_CARDS     = 4   // tope de tarjetas de match en el email
const DIAS_VENTANA  = 7

export default {
  // ── Cron trigger ─────────────────────────────────────────────────
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runWeekly(env))
  },

  // ── HTTP (prueba manual) ──────────────────────────────────────────
  // ?audience=admins → envía SOLO a usuarios con rol admin (prueba de cómo llega
  // el correo, sin spamear a los free). Por defecto: la audiencia real (free).
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.headers.get('Authorization') !== `Bearer ${env.CRON_SECRET}`) {
      return new Response('Unauthorized', { status: 401 })
    }
    const audience = new URL(request.url).searchParams.get('audience') === 'admins'
      ? 'admins' as const
      : 'free' as const
    const result = await runWeekly(env, audience)
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    })
  },
}

type Audience = 'free' | 'admins'

// ── Lógica principal ──────────────────────────────────────────────
async function runWeekly(env: Env, audience: Audience = 'free') {
  const log: string[] = []

  // Resumen general de la semana — se calcula una sola vez (igual para todos).
  const resumen = await buildResumenSemana(env)
  log.push(`Resumen: ${resumen.fondosNuevos} fondos / ${resumen.licitacionesNuevas} licitaciones nuevas · cierran ${resumen.fondosCierran} fondos / ${resumen.licitacionesCierran} licitaciones`)

  // Audiencia:
  //   · 'free'   (real): plan free, no archivados, no internos.
  //   · 'admins' (prueba): solo rol admin, sin filtrar internos — para previsualizar.
  const query = audience === 'admins'
    ? '/rest/v1/profiles?role=eq.admin&archived_at=is.null&select=id,is_internal'
    : '/rest/v1/profiles?plan=eq.free&archived_at=is.null&select=id,is_internal'
  const profiles = await sbGet<{ id: string; is_internal: boolean | null }[]>(env, query)
  if (!profiles?.length) return { ok: true, message: `No users for audience=${audience}`, log }

  const destinatarios = audience === 'admins' ? profiles : profiles.filter(p => !p.is_internal)
  log.push(`Audiencia: ${audience} · destinatarios: ${destinatarios.length}`)

  let totalEmails  = 0
  let totalErrores = 0

  // Aislamiento por usuario: un fallo no aborta toda la corrida (igual que el
  // digest diario).
  for (const profile of destinatarios) {
    try {
      const sent = await processUser(env, profile.id, resumen, log)
      if (sent) totalEmails++
    } catch (e) {
      totalErrores++
      const msg = e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e)
      log.push(`  ⚠️ ERROR procesando user ${profile.id}: ${msg}`)
      console.error(`[weekly] error en user ${profile.id}:`, e)
    }
  }

  log.push(`Emails enviados: ${totalEmails}${totalErrores ? ` · Errores: ${totalErrores}` : ''}`)
  return { ok: true, errores: totalErrores, log }
}

// ── Resumen general de la semana ──────────────────────────────────
// Conteos EXACTOS por tipo (vía Prefer: count=exact). No traemos filas, así que
// no nos topamos con el límite de 1000 de PostgREST.
interface Resumen {
  fondosNuevos:        number
  licitacionesNuevas:  number
  fondosCierran:       number
  licitacionesCierran: number
}

async function buildResumenSemana(env: Env): Promise<Resumen> {
  const hace7 = new Date(Date.now() - DIAS_VENTANA * 86400000).toISOString()

  // Nuevas convocatorias abiertas en la última semana, por tipo.
  const nuevoBase = `/rest/v1/convocatorias?estado=eq.abierto&created_at=gte.${hace7}`
  const [fondosNuevos, licitacionesNuevas] = await Promise.all([
    sbCount(env, `${nuevoBase}&tipo=eq.fondo`),
    sbCount(env, `${nuevoBase}&tipo=eq.licitacion`),
  ])

  // Cuántas cierran la próxima semana (mañana → +7 días), por tipo.
  const hoy   = new Date()
  const desde = new Date(hoy.getTime() + 86400000).toISOString().split('T')[0]
  const hasta = new Date(hoy.getTime() + DIAS_VENTANA * 86400000).toISOString().split('T')[0]
  const cierreBase = `/rest/v1/convocatorias?estado=eq.abierto` +
    `&fecha_cierre_postulacion=gte.${desde}&fecha_cierre_postulacion=lte.${hasta}`
  const [fondosCierran, licitacionesCierran] = await Promise.all([
    sbCount(env, `${cierreBase}&tipo=eq.fondo`),
    sbCount(env, `${cierreBase}&tipo=eq.licitacion`),
  ])

  return { fondosNuevos, licitacionesNuevas, fondosCierran, licitacionesCierran }
}

// ── Procesar un usuario free ──────────────────────────────────────
async function processUser(env: Env, userId: string, resumen: Resumen, log: string[]): Promise<boolean> {
  const authUser = await sbAdminGet<{ email: string }>(env, `/auth/v1/admin/users/${userId}`)
  if (!authUser?.email) return false

  // Alertas activas + datos del proyecto vinculado (para filtrar por compatibilidad).
  const alertas = await sbGet<any[]>(
    env,
    `/rest/v1/alert_configs?user_id=eq.${userId}&activo=eq.true` +
    `&select=*,proyecto:proyectos(tipo_persona,estado_proyecto,foco,alcance,monto_minimo)`
  ) ?? []

  // IDs donde ya postuló — no mostrarlas como novedad.
  const postulaciones = await sbGet<{ convocatoria_id: string }[]>(
    env, `/rest/v1/postulaciones?user_id=eq.${userId}&select=convocatoria_id`
  ) ?? []
  const idsPostulados = postulaciones.map(p => p.convocatoria_id)

  // Matches de la semana (solo lectura: ventana fija de 7 días, NO usa
  // last_notified_at y NO lo modifica).
  const desde = new Date(Date.now() - DIAS_VENTANA * 86400000)
  const vistos = new Set<string>()
  const matches: any[] = []
  for (const alerta of alertas) {
    const items       = await fetchMatches(env, alerta, desde, idsPostulados)
    const compatibles = filtrarPorCompatibilidad(items, alerta.proyecto)
    for (const it of compatibles) {
      if (vistos.has(it.id)) continue
      vistos.add(it.id)
      matches.push(it)
    }
  }
  const fondosMatch       = matches.filter(m => m.tipo === 'fondo')
  const licitacionesMatch = matches.filter(m => m.tipo === 'licitacion')

  const tieneAlerta = alertas.length > 0
  log.push(`  ${authUser.email} | ${tieneAlerta ? `${fondosMatch.length} fondo(s) / ${licitacionesMatch.length} licitación(es)` : 'sin alerta'}`)

  const emailOk = await sendEmail(env, authUser.email, resumen, tieneAlerta, fondosMatch, licitacionesMatch)
  if (!emailOk) {
    log.push(`  ${authUser.email} | envío Resend falló`)
    return false
  }
  return true
}

// ── Matching query (misma lógica que el digest diario) ────────────
async function fetchMatches(env: Env, alerta: any, desde: Date, idsPostulados: string[] = []) {
  const foco     = (alerta.foco ?? []) as string[]
  const keywords = (alerta.palabras_clave ?? []) as string[]

  const params = new URLSearchParams()
  const hoy = new Date().toISOString().split('T')[0]
  params.set('estado',     'eq.abierto')
  params.set('created_at', `gt.${desde.toISOString()}`)
  params.set('select',     SELECT_CONV)
  params.set('order',      'created_at.desc')
  params.set('limit',      '20')

  if (alerta.tipos?.length)           params.set('tipo',    `in.(${alerta.tipos.join(',')})`)
  if (alerta.fuentes?.length)         params.set('fuente',  `in.(${alerta.fuentes.join(',')})`)
  if (alerta.alcance_interes?.length) params.set('alcance', `in.(${alerta.alcance_interes.join(',')})`)

  if (alerta.monto_rangos?.length) {
    params.set('monto_rango', `in.(${alerta.monto_rangos.join(',')})`)
  } else if (alerta.monto_minimo) {
    const idx = MONTO_ORDER.indexOf(alerta.monto_minimo)
    if (idx >= 0) params.set('monto_rango', `in.(${MONTO_ORDER.slice(idx).join(',')})`)
  }

  if (foco.length) params.set('foco', `cs.{${foco.join(',')}}`)

  const dateOr = `or(fecha_cierre_postulacion.gte.${hoy},fecha_cierre_postulacion.is.null)`
  if (keywords.length) {
    const keywordsOr = keywords.flatMap(k => [
      `titulo.ilike.*${k}*`,
      `descripcion_breve.ilike.*${k}*`,
    ]).join(',')
    params.set('and', `(${dateOr},or(${keywordsOr}))`)
  } else {
    params.set('or', `(fecha_cierre_postulacion.gte.${hoy},fecha_cierre_postulacion.is.null)`)
  }

  if (idsPostulados.length)
    params.set('id', `not.in.(${idsPostulados.join(',')})`)

  const data = await sbGet<any[]>(env, `/rest/v1/convocatorias?${params.toString()}`)
  return data ?? []
}

// Filtra candidatos contra el perfil del proyecto vinculado (misma lógica que la UI).
function filtrarPorCompatibilidad(items: any[], proyecto: Perfil | null | undefined): any[] {
  if (!proyecto) return items
  const perfil: Perfil = {
    tipo_persona:    proyecto.tipo_persona    ?? null,
    estado_proyecto: proyecto.estado_proyecto ?? null,
    foco:            proyecto.foco            ?? [],
    alcance:         proyecto.alcance         ?? [],
    monto_minimo:    proyecto.monto_minimo    ?? null,
  }
  return items.filter(c => calcularMatch(perfil, c).score >= SCORE_MIN)
}

// ── Enviar email ──────────────────────────────────────────────────
async function sendEmail(
  env: Env,
  to: string,
  resumen: Resumen,
  tieneAlerta: boolean,
  fondosMatch: any[],
  licitacionesMatch: any[],
): Promise<boolean> {
  // El subject privilegia los fondos (lo escaso/valioso); si no hubo, cae a licitaciones.
  const subject = resumen.fondosNuevos > 0
    ? `Tu resumen semanal · ${resumen.fondosNuevos} fondo${resumen.fondosNuevos !== 1 ? 's' : ''} nuevo${resumen.fondosNuevos !== 1 ? 's' : ''}`
    : `Tu resumen semanal · ${resumen.licitacionesNuevas} licitaciones nuevas`

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
      html:    buildEmail(env, to, resumen, tieneAlerta, fondosMatch, licitacionesMatch),
    }),
  })
  return res.ok
}

// ── HTML del email ────────────────────────────────────────────────
function buildEmail(
  env: Env,
  email: string,
  resumen: Resumen,
  tieneAlerta: boolean,
  fondosMatch: any[],
  licitacionesMatch: any[],
): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <tr><td style="background:#0f172a;border-radius:16px 16px 0 0;padding:28px 36px;">
    <img src="https://app.fondosylicitaciones.cl/logo-white.png" alt="Fondos y Licitaciones" height="36" style="display:block;border:0;" />
  </td></tr>

  <tr><td style="background:white;padding:36px 36px 28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0f172a;letter-spacing:-0.025em;">
      Tu resumen de la semana
    </h1>
    <p style="margin:0 0 28px;font-size:15px;color:#64748b;line-height:1.6;">
      Esto es lo que pasó en fondos y licitaciones en los últimos 7 días.
    </p>

    ${buildResumenBlock(resumen)}
    ${tieneAlerta ? buildAlertaBlock(env, fondosMatch, licitacionesMatch) : buildSinAlertaBlock(env)}
    ${buildUpgradeBlock(env)}
  </td></tr>

  <tr><td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;padding:20px 36px;">
    <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;line-height:1.6;">
      Recibiste este resumen semanal como usuario del plan Free en <strong>${esc(email)}</strong>.<br/>
      <a href="${env.APP_URL}/dashboard/alertas" style="color:#94a3b8;text-decoration:underline;">Gestionar mis alertas</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

// Bloque 1 — panorama general de la semana. Fondos y licitaciones separados,
// con conteo exacto. Una línea aparte resume los cierres de la próxima semana.
function buildResumenBlock(r: Resumen): string {
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;">
  <tr><td style="padding:20px 24px;">
    <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#94a3b8;">📊 &nbsp;Esta semana en la plataforma</span>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;">
      <tr>
        <td align="center" width="50%" style="padding:6px;">
          <div style="font-size:30px;font-weight:800;color:#16a34a;line-height:1;">${r.fondosNuevos}</div>
          <div style="font-size:12px;color:#64748b;margin-top:5px;">fondos nuevos</div>
        </td>
        <td align="center" width="50%" style="padding:6px;border-left:1px solid #e2e8f0;">
          <div style="font-size:30px;font-weight:800;color:#4338ca;line-height:1;">${r.licitacionesNuevas}</div>
          <div style="font-size:12px;color:#64748b;margin-top:5px;">licitaciones nuevas</div>
        </td>
      </tr>
    </table>
    <p style="margin:14px 0 0;font-size:13px;color:#64748b;text-align:center;">
      📅 Cierran la próxima semana: <strong>${r.fondosCierran}</strong> fondo${r.fondosCierran !== 1 ? 's' : ''} · <strong>${r.licitacionesCierran}</strong> licitacion${r.licitacionesCierran !== 1 ? 'es' : ''}
    </p>
  </td></tr>
</table>`
}

// Bloque 2a — el usuario TIENE alerta. Fondos protagonista (tarjetas completas)
// y licitaciones en bloque compacto (conteo + link), porque el volumen de
// licitaciones es mucho mayor y enterraría a los fondos.
function buildAlertaBlock(env: Env, fondosMatch: any[], licitacionesMatch: any[]): string {
  const total = fondosMatch.length + licitacionesMatch.length
  if (total === 0) {
    return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
  <tr><td style="padding-bottom:10px;">
    <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#94a3b8;">🔔 &nbsp;Tu alerta</span>
  </td></tr>
  <tr><td style="border:1px solid #e2e8f0;border-radius:11px;padding:18px 20px;background:white;font-size:14px;color:#64748b;line-height:1.6;">
    Esta semana no hubo convocatorias nuevas que calzaran con tu alerta — pero se publicaron varias oportunidades.
    <a href="${env.APP_URL}/dashboard/alertas" style="color:#0ea5e9;text-decoration:none;font-weight:600;">Revisa o ajusta tu alerta →</a>
  </td></tr>
</table>`
  }

  return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
  <tr><td style="padding-bottom:12px;">
    <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#94a3b8;">🔔 &nbsp;Tu alerta esta semana</span>
  </td></tr>
  <tr><td>${buildFondosSeccion(env, fondosMatch)}</td></tr>
  ${licitacionesMatch.length ? `<tr><td height="14"></td></tr><tr><td>${buildLicitacionesCompacto(env, licitacionesMatch.length)}</td></tr>` : ''}
</table>`
}

// Fondos: tarjetas completas (protagonista).
function buildFondosSeccion(env: Env, fondos: any[]): string {
  if (!fondos.length) {
    return `
<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#16a34a;margin-bottom:8px;">🟢 &nbsp;Fondos para ti</div>
<div style="border:1px solid #e2e8f0;border-radius:11px;padding:16px 20px;background:white;font-size:13px;color:#64748b;line-height:1.6;">
  Esta semana no hubo fondos nuevos que calcen con tu alerta.
</div>`
  }
  const top    = fondos.slice(0, MAX_CARDS)
  const cards  = top.map(item => buildCard(env, item)).join('<tr><td height="8"></td></tr>')
  const hayMas = fondos.length > top.length
  return `
<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#16a34a;margin-bottom:8px;">🟢 &nbsp;Fondos para ti (${fondos.length})</div>
<table width="100%" cellpadding="0" cellspacing="0">
  ${cards}
  ${hayMas ? `
  <tr><td height="8"></td></tr>
  <tr><td style="text-align:center;">
    <a href="${env.APP_URL}/dashboard/alertas" style="font-size:13px;color:#0ea5e9;text-decoration:none;font-weight:600;">Ver todos los fondos →</a>
  </td></tr>` : ''}
</table>`
}

// Licitaciones: bloque compacto (solo conteo + link al panel).
function buildLicitacionesCompacto(env: Env, n: number): string {
  return `
<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#4338ca;margin-bottom:8px;">🔵 &nbsp;Licitaciones</div>
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td style="border:1px solid #e2e8f0;border-radius:11px;padding:16px 20px;background:white;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-size:14px;color:#334155;line-height:1.5;vertical-align:middle;">
        <strong>${n}</strong> licitación${n !== 1 ? 'es' : ''} ${n !== 1 ? 'calzan' : 'calza'} con tu alerta esta semana.
      </td>
      <td align="right" style="vertical-align:middle;white-space:nowrap;">
        <a href="${env.APP_URL}/dashboard/alertas" style="display:inline-block;background:#0f172a;color:white;font-size:12px;font-weight:700;text-decoration:none;padding:8px 16px;border-radius:8px;">
          Verlas en el panel →
        </a>
      </td>
    </tr></table>
  </td></tr>
</table>`
}

// Bloque 2b — el usuario NO tiene alerta: invitación a crear una / hacer gestión.
function buildSinAlertaBlock(env: Env): string {
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
  <tr><td style="border:1px dashed #cbd5e1;border-radius:12px;padding:22px 24px;background:#fafbfc;">
    <div style="font-size:16px;font-weight:700;color:#0f172a;margin-bottom:6px;">Aún no tienes una alerta configurada</div>
    <p style="margin:0 0 16px;font-size:14px;color:#64748b;line-height:1.6;">
      Crea una alerta con tu foco, fuentes y montos de interés y te mostraremos exactamente las
      convocatorias que calzan con tu proyecto. También puedes calcular tu Match con cualquier fondo.
    </p>
    <a href="${env.APP_URL}/dashboard/alertas"
       style="display:inline-block;background:#0f172a;color:white;font-size:14px;font-weight:700;text-decoration:none;padding:11px 22px;border-radius:10px;margin-right:8px;">
      Crear mi alerta →
    </a>
    <a href="${env.APP_URL}/dashboard/match"
       style="display:inline-block;background:white;border:1.5px solid #e2e8f0;color:#0f172a;font-size:14px;font-weight:700;text-decoration:none;padding:11px 22px;border-radius:10px;">
      Calcular mi Match
    </a>
  </td></tr>
</table>`
}

// Bloque 3 — upsell a Pro (notificación diaria).
function buildUpgradeBlock(env: Env): string {
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
  <tr><td style="background:#0ea5e9;border-radius:14px;padding:24px 28px;">
    <div style="font-size:17px;font-weight:800;color:white;margin-bottom:6px;">¿Quieres esto todos los días?</div>
    <p style="margin:0 0 18px;font-size:14px;color:#e0f2fe;line-height:1.6;">
      Con Plan Pro recibes las oportunidades que calzan con tu alerta <strong>apenas se publican</strong>,
      no una vez por semana — además de recordatorios de cierre y match ilimitado.
    </p>
    <a href="${env.APP_URL}/planes"
       style="display:inline-block;background:white;color:#0369a1;font-size:14px;font-weight:800;text-decoration:none;padding:12px 26px;border-radius:11px;">
      Activar notificación diaria →
    </a>
  </td></tr>
</table>`
}

function buildCard(env: Env, item: any): string {
  const fuente = FUENTE_LABELS[item.fuente] ?? item.fuente ?? ''
  const monto  = item.monto_rango ? (MONTO_LABELS[item.monto_rango] ?? '') : ''
  const cierre = item.fecha_cierre_postulacion
    ? `Cierra ${new Date(item.fecha_cierre_postulacion).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : ''
  const detalle = `${env.APP_URL}/r?to=${encodeURIComponent(`/dashboard/oportunidades/${item.id}`)}&conv=${item.id}&weekly=1`
  const focos   = ((item.foco ?? []) as string[]).slice(0, 3).join(' · ')
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

// Conteo EXACTO sin traer filas: Prefer count=exact + Range 0-0 → el total viene
// en el header Content-Range ("0-0/<total>"). Evita el límite de 1000 de PostgREST.
async function sbCount(env: Env, path: string): Promise<number> {
  const res = await fetch(`${env.SUPABASE_URL}${path}&select=id`, {
    headers: { ...sbHeaders(env), 'Prefer': 'count=exact', 'Range': '0-0' },
  })
  if (!res.ok && res.status !== 206) return 0
  const m = (res.headers.get('Content-Range') ?? '').match(/\/(\d+)$/)
  return m ? parseInt(m[1], 10) : 0
}

// ── Utilidades ────────────────────────────────────────────────────
function esc(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n).trimEnd() + '…' : s
}
