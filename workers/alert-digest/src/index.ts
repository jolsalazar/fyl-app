import { calcularMatch, type Perfil } from '../../../shared/match'

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
  incubadoras: 'Incubadoras', fondos_cultura: 'Fondos Cultura',
  santander_x: 'Santander X',
}

// Usuarios procesados por tick. El cron corre cada 5 min en una ventana, así que
// la cohorte se vacía en varios ticks sin pasar el tope de subrequests por
// invocación. Más bajo que el weekly porque el diario, por usuario, además ESCRIBE
// (notificaciones + cursor). Calibrado para Workers Paid (1000 subreq); en Workers
// Free (50) baja a ~10.
const BATCH_LIMIT = 120

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

  // Troceo + sent-log: cada tick del cron procesa el siguiente lote de usuarios
  // NO-procesados hoy; cuando la cohorte se vació, es no-op. Mantiene el costo bajo
  // el tope de subrequests por invocación a cualquier escala, y se auto-repara (lo
  // que falla queda sin registrar y se reintenta en el siguiente tick).
  const runKey = new Date().toISOString().split('T')[0]
  const enviados = await sbGetAll<{ user_id: string }>(
    env, `/rest/v1/digest_sent_log?digest_type=eq.daily&run_key=eq.${runKey}&select=user_id`
  )
  const yaProcesados = new Set(enviados.map(r => r.user_id))

  // 0. Higiene de datos (una vez por día): marcar como 'cerrado' lo que ya pasó su
  // fecha de cierre. Solo en el PRIMER tick (cuando aún no hay nadie procesado hoy),
  // para no repetir el PATCH en cada tick de la ventana.
  if (yaProcesados.size === 0) await closeExpired(env, log)

  // 1. Todos los usuarios con plan. Free entra para que la bandeja web se llene,
  //    pero adentro de processUser se omite el email (emailAlertas = false en free).
  const profiles = await sbGetAll<{ id: string; plan: string }>(
    env, '/rest/v1/profiles?plan=in.(free,starter,advanced,agency)&select=id,plan'
  )
  if (!profiles.length) return { ok: true, message: 'No users', log }

  const pendientes = profiles.filter(p => !yaProcesados.has(p.id))
  log.push(`Run ${runKey}: usuarios ${profiles.length} · ya procesados ${yaProcesados.size} · pendientes ${pendientes.length}`)
  if (!pendientes.length) return { ok: true, message: `Sin pendientes (run ${runKey})`, log }

  const lote = pendientes.slice(0, BATCH_LIMIT)
  log.push(`Lote: ${lote.length}/${pendientes.length} (BATCH_LIMIT=${BATCH_LIMIT})`)

  let totalEmails  = 0
  let totalErrores = 0
  const procesados: string[] = []   // user_id que completaron sin throw → registrar

  // Aislamiento por usuario: una excepción en processUser NO debe abortar el lote.
  // Un throw (p. ej. tope de subrequests) NO se registra → reintento próximo tick.
  for (const profile of lote) {
    try {
      const sent = await processUser(env, profile.id, profile.plan, log)
      if (sent) totalEmails++
      procesados.push(profile.id)
    } catch (e) {
      totalErrores++
      const msg = e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e)
      log.push(`  ⚠️ ERROR procesando user ${profile.id} (plan ${profile.plan}): ${msg}`)
      console.error(`[digest] error en user ${profile.id} (plan ${profile.plan}):`, e)
    }
  }

  // Registrar los procesados de este tick (ignore-duplicates).
  if (procesados.length) {
    await sbInsert(env, '/rest/v1/digest_sent_log',
      procesados.map(user_id => ({ digest_type: 'daily', run_key: runKey, user_id })))
  }

  const quedan = pendientes.length - lote.length
  log.push(`Emails enviados: ${totalEmails}${totalErrores ? ` · Errores: ${totalErrores}` : ''} · quedan ${quedan} para el próximo tick`)
  return { ok: true, errores: totalErrores, enviados: totalEmails, quedan, log }
}

// ── Higiene de datos ──────────────────────────────────────────────
async function closeExpired(env: Env, log: string[]) {
  const hoy = new Date().toISOString().split('T')[0]
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/convocatorias?estado=eq.abierto&fecha_cierre_postulacion=lt.${hoy}`,
    {
      method:  'PATCH',
      headers: { ...sbHeaders(env), 'Prefer': 'return=minimal,count=exact' },
      body:    JSON.stringify({ estado: 'cerrado' }),
    }
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error(`closeExpired failed: ${res.status} ${text}`)
    log.push(`closeExpired falló: ${res.status}`)
    return
  }
  // Content-Range: "0-N/total" o "*/total" cuando return=minimal
  const match = (res.headers.get('Content-Range') ?? '').match(/\/(\d+)$/)
  const count = match ? parseInt(match[1], 10) : 0
  if (count > 0) log.push(`Cerradas ${count} convocatorias vencidas`)
}

// ── Procesar un usuario ───────────────────────────────────────────
async function processUser(env: Env, userId: string, plan: string, log: string[]): Promise<boolean> {
  // Plan free no recibe email pero igual procesamos matches para que la bandeja
  // web se llene. Cualquier plan con `emailAlertas: true` (starter+) recibe email.
  const enviaEmail = plan !== 'free'

  // Email via admin API (solo lo necesitamos para enviar; en free igual lo pedimos
  // para identificar al usuario en el log)
  const authUser = await sbAdminGet<{ email: string }>(env, `/auth/v1/admin/users/${userId}`)
  if (!authUser?.email) return false

  // Alertas activas + datos del proyecto vinculado (para filtrar por compatibilidad real)
  const alertas = await sbGet<any[]>(
    env,
    `/rest/v1/alert_configs?user_id=eq.${userId}&activo=eq.true` +
    `&select=*,proyecto:proyectos(tipo_persona,estado_proyecto,foco,alcance,monto_minimo)`
  )
  if (!alertas?.length) return false

  // IDs donde ya postulé — no notificar
  const postulaciones = await sbGet<{ convocatoria_id: string }[]>(
    env, `/rest/v1/postulaciones?user_id=eq.${userId}&select=convocatoria_id`
  ) ?? []
  const idsPostulados = postulaciones.map(p => p.convocatoria_id)

  const ahora      = new Date().toISOString()
  const resultados: Array<{ alerta: any; items: any[] }> = []
  const sinMatch:   Array<any> = []

  for (const alerta of alertas) {
    const desde = alerta.last_notified_at
      ? new Date(alerta.last_notified_at)
      : new Date(Date.now() - 25 * 60 * 60 * 1000)

    const items = await fetchMatches(env, alerta, desde, idsPostulados)
    const compatibles = filtrarPorCompatibilidad(items, alerta.proyecto)

    if (compatibles.length > 0) {
      resultados.push({ alerta, items: compatibles })
      const filtradas = items.length - compatibles.length
      log.push(`  ${authUser.email} | "${alerta.nombre}": ${compatibles.length} compatibles${filtradas > 0 ? ` (${filtradas} filtradas por score<40)` : ''}`)
    } else {
      sinMatch.push(alerta)
    }
  }

  // Recordatorios de cierre próximo. Son aviso por email — el plan free no los
  // recibe (ver tabla de features: emailAlertas=false). Para starter+ se incluyen
  // junto con los matches en el mismo email; tres caminos para entrar: guardados
  // explícitos, pasa filtros de una alerta activa, o match >= SCORE_RECORDATORIO.
  const proyectoBase = alertas.find(a => a.proyecto)?.proyecto ?? null
  const closures = enviaEmail
    ? await findClosingReminders(env, userId, proyectoBase, alertas, idsPostulados)
    : []
  if (closures.length) {
    log.push(`  ${authUser.email} | ${closures.length} cierre(s) próximo(s)`)
  }

  // Alertas sin match: avanzar el cursor inmediatamente (no hay riesgo de pérdida).
  for (const alerta of sinMatch) {
    await sbPatch(env, `/rest/v1/alert_configs?id=eq.${alerta.id}`, { last_notified_at: ahora })
  }

  if (!resultados.length && !closures.length) return false

  // Plan free: NO se envía email, pero igual escribimos en la bandeja web.
  // Plan starter+: se envía email; si falla, abortamos para reintentar en el
  // próximo cron (no avanzamos last_notified_at ni escribimos la bandeja).
  if (enviaEmail) {
    const total = resultados.reduce((s, r) => s + r.items.length, 0)
    const emailOk = await sendEmail(env, authUser.email, total, resultados, closures)

    if (!emailOk) {
      log.push(`  ${authUser.email} | envío Resend falló — no se actualiza last_notified_at, se reintenta en el próximo cron`)
      return false
    }
  } else {
    log.push(`  ${authUser.email} | plan free — sin email, guardando en bandeja web`)
  }

  // Guardar en bandeja de notificaciones (idempotente: ignora duplicates)
  const notifs = resultados.flatMap(({ alerta, items }) =>
    items.map(item => ({
      user_id:         userId,
      alert_config_id: alerta.id,
      convocatoria_id: item.id,
      notified_at:     ahora,
    }))
  )
  await sbInsert(env, '/rest/v1/alert_notifications', notifs)

  // Marcar los cierres como ya recordados para no volver a mandar ese mismo
  // (usuario, fondo, threshold). Una entrada distinta por threshold.
  if (closures.length) {
    await sbInsert(env, '/rest/v1/closing_reminders_sent',
      closures.map(c => ({
        user_id:          userId,
        convocatoria_id:  c.conv.id,
        dias_anticipados: c.threshold,
      }))
    )
  }

  // Recién acá avanzamos el cursor de las alertas que sí dispararon notificación.
  for (const { alerta } of resultados) {
    await sbPatch(env, `/rest/v1/alert_configs?id=eq.${alerta.id}`, { last_notified_at: ahora })
  }

  return true
}

// ── Recordatorios de cierre próximo ───────────────────────────────
// Convocatorias que cierran en los próximos días que el usuario configuró
// (closing_reminder_days en profiles, default [3]). Para cada candidato se
// elige el threshold más amplio que aún no se haya disparado para ese par
// (usuario, fondo) — así un usuario con [7,3,1] recibe 3 emails escalonados.
// Filtros: guardados del usuario, pasa filtro de alerta activa, o match >= 50.
// Excluye postuladas y las que ya fueron recordadas en ese threshold.
const SCORE_RECORDATORIO = 50
const MAX_CIERRES_EMAIL = 10
const DEFAULT_THRESHOLDS = [3]

function pasaFiltrosAlerta(conv: any, alerta: any): boolean {
  if (alerta.tipos?.length            && !alerta.tipos.includes(conv.tipo))                       return false
  if (alerta.fuentes?.length          && !alerta.fuentes.includes(conv.fuente))                   return false
  if (alerta.alcance_interes?.length  && !alerta.alcance_interes.includes(conv.alcance))          return false

  if (alerta.monto_rangos?.length) {
    if (!alerta.monto_rangos.includes(conv.monto_rango)) return false
  } else if (alerta.monto_minimo) {
    const uIdx = MONTO_ORDER.indexOf(alerta.monto_minimo)
    const cIdx = MONTO_ORDER.indexOf(conv.monto_rango ?? '')
    if (cIdx < 0 || cIdx < uIdx) return false
  }

  if (alerta.foco?.length) {
    const convFoco = (conv.foco ?? []) as string[]
    if (!(alerta.foco as string[]).some((f: string) => convFoco.includes(f))) return false
  }

  if (alerta.palabras_clave?.length) {
    const txt = `${conv.titulo ?? ''} ${conv.descripcion_breve ?? ''}`.toLowerCase()
    if (!(alerta.palabras_clave as string[]).some((k: string) => txt.includes(k.toLowerCase()))) return false
  }

  return true
}

async function findClosingReminders(
  env: Env,
  userId: string,
  proyecto: Perfil | null,
  alertas: any[],
  idsPostulados: string[],
): Promise<Array<{ conv: any; threshold: number }>> {
  // 1) Preferencias del usuario
  const profile = await sbGet<{ closing_reminder_days: number[] | null }[]>(
    env, `/rest/v1/profiles?id=eq.${userId}&select=closing_reminder_days`
  )
  const thresholds = (profile?.[0]?.closing_reminder_days ?? DEFAULT_THRESHOLDS)
    .filter((d): d is number => typeof d === 'number' && d > 0)
    .sort((a, b) => b - a) // descendente: 7, 3, 1
  if (!thresholds.length) return []
  const maxThreshold = thresholds[0]

  // 2) Candidatos: cerrar entre mañana y +maxThreshold días
  const hoy   = new Date()
  const desde = new Date(hoy.getTime() + 86400000).toISOString().split('T')[0]
  const hasta = new Date(hoy.getTime() + maxThreshold * 86400000).toISOString().split('T')[0]

  const params = new URLSearchParams()
  params.set('estado', 'eq.abierto')
  params.set('fecha_cierre_postulacion', `gte.${desde}`)
  params.append('fecha_cierre_postulacion', `lte.${hasta}`)
  params.set('select', 'id,titulo,fuente,tipo,monto_rango,fecha_cierre_postulacion,link_postulacion,descripcion_breve,foco,alcance,perfil_tipo_persona,perfil_nivel_desarrollo,perfil_antiguedad_empresa,perfil_nivel_ventas')
  params.set('order',  'fecha_cierre_postulacion.asc')
  params.set('limit',  '200')
  if (idsPostulados.length) params.set('id', `not.in.(${idsPostulados.join(',')})`)

  const candidatos = await sbGet<any[]>(env, `/rest/v1/convocatorias?${params.toString()}`) ?? []
  if (!candidatos.length) return []

  // 3) Ya enviados (con threshold) y guardados
  const [guardados, recordados] = await Promise.all([
    sbGet<{ convocatoria_id: string }[]>(env, `/rest/v1/guardados?user_id=eq.${userId}&select=convocatoria_id`),
    sbGet<{ convocatoria_id: string; dias_anticipados: number }[]>(
      env, `/rest/v1/closing_reminders_sent?user_id=eq.${userId}&select=convocatoria_id,dias_anticipados`
    ),
  ])
  if (recordados === null) {
    console.error('closing_reminders_sent no accesible — skipping reminders')
    return []
  }
  const guardadosSet  = new Set((guardados ?? []).map(g => g.convocatoria_id))
  const recordadosKey = new Set(recordados.map(r => `${r.convocatoria_id}|${r.dias_anticipados}`))

  const perfil: Perfil | null = proyecto ? {
    tipo_persona:    proyecto.tipo_persona    ?? null,
    estado_proyecto: proyecto.estado_proyecto ?? null,
    foco:            proyecto.foco            ?? [],
    alcance:         proyecto.alcance         ?? [],
    monto_minimo:    proyecto.monto_minimo    ?? null,
  } : null

  // 4) Para cada candidato: ¿pasa los filtros? ¿qué threshold le toca disparar?
  const out: Array<{ conv: any; threshold: number }> = []
  for (const c of candidatos) {
    const pasaFiltro =
      guardadosSet.has(c.id) ||
      alertas.some(a => pasaFiltrosAlerta(c, a)) ||
      (!!perfil && calcularMatch(perfil, c).score >= SCORE_RECORDATORIO)
    if (!pasaFiltro) continue

    const diasRestantes = Math.ceil((new Date(c.fecha_cierre_postulacion).getTime() - Date.now()) / 86400000)
    // Buscar el threshold más amplio que cubre los días restantes y que aún no se mandó.
    // Recorremos descendente para preferir mandar 7d antes que 3d, etc.
    const t = thresholds.find(t => diasRestantes <= t && !recordadosKey.has(`${c.id}|${t}`))
    if (t === undefined) continue
    out.push({ conv: c, threshold: t })
  }

  return out.slice(0, MAX_CIERRES_EMAIL)
}

// ── Matching query ────────────────────────────────────────────────
async function fetchMatches(env: Env, alerta: any, desde: Date, idsPostulados: string[] = []) {
  const foco     = (alerta.foco ?? []) as string[]
  const keywords = (alerta.palabras_clave ?? []) as string[]

  const params = new URLSearchParams()
  const hoy = new Date().toISOString().split('T')[0]
  params.set('estado',     'eq.abierto')
  params.set('created_at', `gt.${desde.toISOString()}`)
  params.set('select',     'id,titulo,fuente,tipo,monto_rango,fecha_cierre_postulacion,link_postulacion,descripcion_breve,foco,alcance,perfil_tipo_persona,perfil_nivel_desarrollo,perfil_antiguedad_empresa,perfil_nivel_ventas')
  params.set('order',      'created_at.desc')
  // Sobre-fetchea: 5 finales se cubren incluso si filtramos algunas por compatibilidad.
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

  // foco overlap — PostgREST usa cs (contains) para arrays
  if (foco.length) params.set('foco', `cs.{${foco.join(',')}}`)

  // Filtros que comparten el operador `or` (no emailear vencidas + keywords):
  // si ambos aplican, los combinamos en un solo `and(or(...),or(...))`.
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

  // Excluir fondos donde el usuario ya postuló
  if (idsPostulados.length)
    params.set('id', `not.in.(${idsPostulados.join(',')})`)

  const data = await sbGet<any[]>(env, `/rest/v1/convocatorias?${params.toString()}`)
  return data ?? []
}

// Filtra los candidatos del PostgREST contra el perfil del proyecto vinculado a la alerta.
// Usa la MISMA lógica que la UI in-app (shared/match.ts). Si la alerta no tiene proyecto
// ligado, no filtra (back-compat). Si calcularMatch no encuentra dimensiones comparables
// (convocatoria con perfil_* vacío), devuelve score 50 → no se filtra.
const SCORE_MIN = 40
const MAX_POR_ALERTA = 5

function filtrarPorCompatibilidad(items: any[], proyecto: Perfil | null | undefined): any[] {
  if (!proyecto) return items.slice(0, MAX_POR_ALERTA)
  const perfil: Perfil = {
    tipo_persona:    proyecto.tipo_persona    ?? null,
    estado_proyecto: proyecto.estado_proyecto ?? null,
    foco:            proyecto.foco            ?? [],
    alcance:         proyecto.alcance         ?? [],
    monto_minimo:    proyecto.monto_minimo    ?? null,
  }
  return items
    .filter(c => calcularMatch(perfil, c).score >= SCORE_MIN)
    .slice(0, MAX_POR_ALERTA)
}

// ── Enviar email ──────────────────────────────────────────────────
async function sendEmail(
  env: Env,
  to: string,
  total: number,
  resultados: Array<{ alerta: any; items: any[] }>,
  closures: Array<{ conv: any; threshold: number }>,
): Promise<boolean> {
  const subject = buildSubject(total, closures.length)
  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    'Fondos y Licitaciones <alertas@fondosylicitaciones.cl>',
      to:      [to],
      subject,
      html:    buildEmail(env, to, total, resultados, closures),
    }),
  })
  return res.ok
}

function buildSubject(nuevos: number, cierres: number): string {
  if (nuevos && cierres) {
    return `${nuevos} nueva${nuevos !== 1 ? 's' : ''} · ${cierres} cierra${cierres !== 1 ? 'n' : ''} pronto`
  }
  if (cierres) {
    return `${cierres} fondo${cierres !== 1 ? 's' : ''} cierra${cierres !== 1 ? 'n' : ''} pronto`
  }
  return `${nuevos} nueva${nuevos !== 1 ? 's' : ''} oportunidad${nuevos !== 1 ? 'es' : ''} para ti`
}

// ── HTML del email ────────────────────────────────────────────────
function buildEmail(
  env: Env,
  email: string,
  total: number,
  resultados: Array<{ alerta: any; items: any[] }>,
  closures: Array<{ conv: any; threshold: number }>,
): string {
  const plural    = total !== 1
  const secciones = resultados.map(r => buildSeccion(env, r.alerta, r.items)).join('')
  const cierres   = closures.length ? buildSeccionCierres(env, closures) : ''

  // Si solo hay cierres (sin nuevas), el bloque introductorio cambia.
  const heading = total > 0
    ? `${total} nueva${plural ? 's' : ''} oportunidad${plural ? 'es' : ''} para ti`
    : `${closures.length} fondo${closures.length !== 1 ? 's' : ''} cierra${closures.length !== 1 ? 'n' : ''} pronto`
  const intro = total > 0
    ? `${plural ? 'Estas convocatorias abrieron' : 'Esta convocatoria abrió'} desde tu última notificación y coincide${plural ? 'n' : ''} con tus alertas.`
    : `${closures.length === 1 ? 'Este fondo cierra' : 'Estos fondos cierran'} pronto. Los guardaste o tienen alto match con tu proyecto.`

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
      ${heading}
    </h1>
    <p style="margin:0 0 28px;font-size:15px;color:#64748b;line-height:1.6;">
      ${intro}
    </p>

    ${cierres}
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

function buildSeccionCierres(env: Env, items: Array<{ conv: any; threshold: number }>): string {
  const cards = items.map(it => buildCardCierre(env, it.conv)).join('<tr><td height="8"></td></tr>')
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
  <tr><td style="padding-bottom:10px;">
    <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#dc2626;">
      ⏰ &nbsp;Cierran pronto
    </span>
  </td></tr>
  ${cards}
</table>`
}

function buildCardCierre(env: Env, item: any): string {
  const fuente = FUENTE_LABELS[item.fuente] ?? item.fuente ?? ''
  const dias = item.fecha_cierre_postulacion
    ? Math.max(0, Math.ceil((new Date(item.fecha_cierre_postulacion).getTime() - Date.now()) / 86400000))
    : null
  const cierreLabel = dias === 0 ? 'Cierra hoy'
    : dias === 1 ? 'Cierra mañana'
    : dias !== null ? `Cierra en ${dias} días`
    : ''
  const detalle = `${env.APP_URL}/r?to=${encodeURIComponent(`/dashboard/oportunidades/${item.id}`)}&conv=${item.id}&closing=1`
  const link    = item.link_postulacion || detalle

  return `
<tr><td style="border:1px solid #fecaca;border-left:4px solid #dc2626;border-radius:11px;padding:16px 20px;background:#fef2f2;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td>
      <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#0ea5e9;">${esc(fuente)}</span>
      <span style="font-size:10px;font-weight:700;color:#dc2626;margin-left:8px;">${esc(cierreLabel)}</span>
    </td></tr>
    <tr><td height="6"></td></tr>
    <tr><td style="font-size:15px;font-weight:700;color:#0f172a;line-height:1.35;">${esc(item.titulo ?? '')}</td></tr>
    <tr><td height="12"></td></tr>
    <tr><td align="right">
      <a href="${detalle}" style="display:inline-block;background:#0f172a;color:white;font-size:12px;font-weight:700;text-decoration:none;padding:7px 16px;border-radius:8px;">
        Ver detalle →
      </a>
      ${item.link_postulacion ? `
      <a href="${link}" style="display:inline-block;background:#dc2626;color:white;font-size:12px;font-weight:700;text-decoration:none;padding:7px 16px;border-radius:8px;margin-left:6px;">
        Postular ya →
      </a>` : ''}
    </td></tr>
  </table>
</td></tr>`
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

// Lectura paginada con header Range: PostgREST corta en 1000 filas por request,
// así que iteramos páginas hasta agotar para no truncar la lista completa.
async function sbGetAll<T>(env: Env, path: string, pageSize = 1000): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; from < 100_000; from += pageSize) {
    const to  = from + pageSize - 1
    const res = await fetch(`${env.SUPABASE_URL}${path}`, {
      headers: { ...sbHeaders(env), 'Range-Unit': 'items', 'Range': `${from}-${to}` },
    })
    if (!res.ok && res.status !== 206) break
    const page = (await res.json()) as T[]
    all.push(...page)
    if (page.length < pageSize) break
  }
  return all
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

async function sbPatch(env: Env, path: string, body: object): Promise<boolean> {
  const res = await fetch(`${env.SUPABASE_URL}${path}`, {
    method:  'PATCH',
    headers: { ...sbHeaders(env), 'Prefer': 'return=minimal' },
    body:    JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error(`sbPatch ${path} failed: ${res.status} ${text}`)
  }
  return res.ok
}

async function sbInsert(env: Env, path: string, body: object[]) {
  if (!body.length) return
  const res = await fetch(`${env.SUPABASE_URL}${path}`, {
    method:  'POST',
    headers: { ...sbHeaders(env), 'Prefer': 'resolution=ignore-duplicates,return=minimal' },
    body:    JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error(`sbInsert ${path} failed: ${res.status} ${text}`)
  }
}

// ── Utilidades ────────────────────────────────────────────────────
function esc(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n).trimEnd() + '…' : s
}
