import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL        = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY      = Deno.env.get('RESEND_API_KEY')!
const CRON_SECRET         = Deno.env.get('CRON_SECRET')!
const APP_URL             = 'https://app.fondosylicitaciones.cl'

const MONTO_ORDER = ['hasta_1M', '1M_10M', '10M_30M', '30M_60M', '60M_100M', 'sobre_100M']

const MONTO_LABELS: Record<string, string> = {
  hasta_1M: 'Hasta $1M', '1M_10M': '$1M–$10M', '10M_30M': '$10M–$30M',
  '30M_60M': '$30M–$60M', '60M_100M': '$60M–$100M', sobre_100M: 'Más de $100M',
}

const FUENTE_LABELS: Record<string, string> = {
  corfo: 'CORFO', sercotec: 'SERCOTEC', anid: 'ANID',
  mercadopublico: 'Mercado Público', fondos_gob: 'Fondos.gob.cl',
}

// ── Handler ───────────────────────────────────────────────────────
Deno.serve(async (req) => {
  // Solo acepta llamadas autorizadas (desde el cron o manualmente)
  const auth = req.headers.get('Authorization')
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const log: string[] = []

  try {
    // 1. Obtener todos los usuarios Pro/Agencia
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .in('plan', ['pro', 'agencia'])

    if (!profiles?.length) {
      return json({ ok: true, message: 'No pro users found' })
    }

    log.push(`Procesando ${profiles.length} usuarios Pro`)

    let totalEmails = 0

    for (const profile of profiles) {
      const sent = await processUser(supabase, profile.id, log)
      if (sent) totalEmails++
    }

    log.push(`Emails enviados: ${totalEmails}`)
    return json({ ok: true, log })

  } catch (e) {
    return new Response(String(e), { status: 500 })
  }
})

// ── Procesar un usuario ────────────────────────────────────────────
async function processUser(supabase: any, userId: string, log: string[]): Promise<boolean> {
  // Email del usuario
  const { data: { user } } = await supabase.auth.admin.getUserById(userId)
  if (!user?.email) return false

  // Alertas activas
  const { data: alertas } = await supabase
    .from('alert_configs')
    .select('*')
    .eq('user_id', userId)
    .eq('activo', true)

  if (!alertas?.length) return false

  const resultadosPorAlerta: Array<{ alerta: any; items: any[] }> = []
  const ahora = new Date().toISOString()

  for (const alerta of alertas) {
    // Buscar desde la última notificación, o las últimas 25 horas si es la primera vez
    const desde = alerta.last_notified_at
      ? new Date(alerta.last_notified_at)
      : new Date(Date.now() - 25 * 60 * 60 * 1000)

    const items = await fetchMatches(supabase, alerta, desde)

    if (items.length > 0) {
      resultadosPorAlerta.push({ alerta, items })
      log.push(`  ${user.email} | "${alerta.nombre}": ${items.length} nuevas`)
    }

    // Actualizar last_notified_at siempre (para no re-notificar lo mismo)
    await supabase
      .from('alert_configs')
      .update({ last_notified_at: ahora })
      .eq('id', alerta.id)
  }

  if (!resultadosPorAlerta.length) return false

  const totalNuevas = resultadosPorAlerta.reduce((s, r) => s + r.items.length, 0)

  await sendEmail(user.email, totalNuevas, resultadosPorAlerta)
  return true
}

// ── Query de matching (misma lógica que el frontend) ──────────────
async function fetchMatches(supabase: any, alerta: any, desde: Date) {
  let q = supabase
    .from('convocatorias')
    .select('id, titulo, fuente, tipo, monto_rango, fecha_cierre_postulacion, link_postulacion, descripcion_breve, foco')
    .eq('estado', 'abierto')
    .gt('fecha_scrapeado', desde.toISOString())
    .limit(5) // máximo 5 por alerta en el email

  const foco     = alerta.foco ?? []
  const keywords = alerta.palabras_clave ?? []

  if (keywords.length) {
    const terms = keywords
      .flatMap((k: string) => [`titulo.ilike.%${k}%`, `descripcion_breve.ilike.%${k}%`])
      .join(',')
    q = q.or(terms)
  }
  if (foco.length) q = q.overlaps('foco', foco)

  if (alerta.tipos?.length)            q = q.in('tipo', alerta.tipos)
  if (alerta.fuentes?.length)          q = q.in('fuente', alerta.fuentes)
  if (alerta.alcance_interes?.length)  q = q.in('alcance', alerta.alcance_interes)

  if (alerta.monto_rangos?.length) {
    q = q.in('monto_rango', alerta.monto_rangos)
  } else if (alerta.monto_minimo) {
    const idx = MONTO_ORDER.indexOf(alerta.monto_minimo)
    if (idx >= 0) q = q.in('monto_rango', MONTO_ORDER.slice(idx))
  }

  const { data } = await q.order('fecha_scrapeado', { ascending: false })
  return data ?? []
}

// ── Enviar email via Resend ────────────────────────────────────────
async function sendEmail(
  to: string,
  totalNuevas: number,
  resultados: Array<{ alerta: any; items: any[] }>
) {
  const plural = totalNuevas !== 1
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Fondos y Licitaciones <alertas@fondosylicitaciones.cl>',
      to:   [to],
      subject: `${totalNuevas} nueva${plural ? 's' : ''} oportunidad${plural ? 'es' : ''} para ti`,
      html: buildEmail(to, totalNuevas, resultados),
    }),
  })
}

// ── HTML del email ────────────────────────────────────────────────
function buildEmail(
  email: string,
  totalNuevas: number,
  resultados: Array<{ alerta: any; items: any[] }>
): string {
  const plural = totalNuevas !== 1
  const seccionesAlertas = resultados.map(({ alerta, items }) => buildSeccionAlerta(alerta, items)).join('')

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Nuevas oportunidades</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- Header -->
  <tr><td style="background:#0f172a;border-radius:16px 16px 0 0;padding:28px 36px;">
    <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#0ea5e9;box-shadow:0 0 8px #0ea5e9;margin-right:8px;vertical-align:middle;"></span>
    <span style="color:white;font-size:17px;font-weight:800;letter-spacing:-0.02em;vertical-align:middle;">Fondos y Licitaciones</span>
  </td></tr>

  <!-- Body -->
  <tr><td style="background:white;padding:36px 36px 28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">

    <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0f172a;letter-spacing:-0.025em;">
      ${totalNuevas} nueva${plural ? 's' : ''} oportunidad${plural ? 'es' : ''} para ti
    </h1>
    <p style="margin:0 0 28px;font-size:15px;color:#64748b;line-height:1.6;">
      ${plural ? 'Estas son las convocatorias que abrieron' : 'Esta es la convocatoria que abrió'} desde tu última notificación y coincide${plural ? 'n' : ''} con tus alertas.
    </p>

    ${seccionesAlertas}

    <!-- CTA principal -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;padding-top:28px;border-top:1px solid #f1f5f9;">
      <tr><td align="center">
        <a href="${APP_URL}/dashboard/alertas"
           style="display:inline-block;background:#0ea5e9;color:white;font-size:15px;font-weight:700;text-decoration:none;padding:13px 32px;border-radius:11px;letter-spacing:-0.01em;">
          Ver todas en el dashboard →
        </a>
      </td></tr>
    </table>

  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;padding:20px 36px;">
    <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;line-height:1.6;">
      Recibiste este email como usuario Plan Pro en <strong>${email}</strong>.<br/>
      <a href="${APP_URL}/dashboard/alertas" style="color:#94a3b8;text-decoration:underline;">Gestionar mis alertas</a>
      &nbsp;·&nbsp;
      <a href="${APP_URL}/dashboard/configuracion" style="color:#94a3b8;text-decoration:underline;">Configuración</a>
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

function buildSeccionAlerta(alerta: any, items: any[]): string {
  const convocatorias = items.map(buildCardConvocatoria).join('<tr><td height="8"></td></tr>')
  const hayMas = items.length >= 5

  return `
  <!-- Alerta: ${escapeHtml(alerta.nombre ?? 'Sin nombre')} -->
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
    <tr><td style="padding-bottom:10px;">
      <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#94a3b8;">
        🔔 &nbsp;${escapeHtml(alerta.nombre ?? 'Mi alerta')}
      </span>
    </td></tr>
    ${convocatorias}
    ${hayMas ? `
    <tr><td height="8"></td></tr>
    <tr><td style="text-align:center;padding-top:4px;">
      <a href="${APP_URL}/dashboard/alertas" style="font-size:13px;color:#0ea5e9;text-decoration:none;font-weight:600;">
        Ver todas las coincidencias →
      </a>
    </td></tr>` : ''}
  </table>`
}

function buildCardConvocatoria(item: any): string {
  const fuente   = FUENTE_LABELS[item.fuente] ?? item.fuente ?? ''
  const monto    = item.monto_rango ? MONTO_LABELS[item.monto_rango] ?? '' : ''
  const cierre   = item.fecha_cierre_postulacion
    ? `Cierra ${new Date(item.fecha_cierre_postulacion).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : ''
  const linkHref = item.link_postulacion || `${APP_URL}/dashboard/oportunidades/${item.id}`
  const focos    = (item.foco ?? []).slice(0, 3).join(' · ')

  return `
  <tr><td style="border:1px solid #e2e8f0;border-radius:11px;padding:16px 20px;background:white;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#0ea5e9;">${escapeHtml(fuente)}</span>
          ${item.tipo === 'fondo'
            ? '<span style="font-size:10px;font-weight:600;background:#f0fdf4;color:#16a34a;padding:2px 7px;border-radius:999px;margin-left:6px;">Fondo</span>'
            : '<span style="font-size:10px;font-weight:600;background:#eef2ff;color:#4338ca;padding:2px 7px;border-radius:999px;margin-left:6px;">Licitación</span>'
          }
        </td>
      </tr>
      <tr><td height="6"></td></tr>
      <tr><td style="font-size:15px;font-weight:700;color:#0f172a;line-height:1.35;">
        ${escapeHtml(item.titulo ?? '')}
      </td></tr>
      ${item.descripcion_breve ? `
      <tr><td height="5"></td></tr>
      <tr><td style="font-size:13px;color:#64748b;line-height:1.5;">
        ${escapeHtml(truncate(item.descripcion_breve, 140))}
      </td></tr>` : ''}
      ${focos ? `
      <tr><td height="8"></td></tr>
      <tr><td style="font-size:11px;color:#94a3b8;">${escapeHtml(focos)}</td></tr>` : ''}
      <tr><td height="12"></td></tr>
      <tr>
        <td>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:12px;color:#94a3b8;vertical-align:middle;">
                ${monto ? `<span style="margin-right:12px;">💰 ${escapeHtml(monto)}</span>` : ''}
                ${cierre ? `<span>📅 ${escapeHtml(cierre)}</span>` : ''}
              </td>
              <td align="right">
                <a href="${linkHref}"
                   style="display:inline-block;background:#0f172a;color:white;font-size:12px;font-weight:700;text-decoration:none;padding:7px 16px;border-radius:8px;">
                  Ver fondo →
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </td></tr>`
}

// ── Utilidades ────────────────────────────────────────────────────
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max).trimEnd() + '…' : str
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
