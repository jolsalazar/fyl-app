// Envío de emails transaccionales vía Resend.
// Usa la misma cuenta/dominio que la edge function send-welcome-email
// (from: hola@fondosylicitaciones.cl). RESEND_API_KEY se configura en el deploy.

const FROM = 'Fondos y Licitaciones <hola@fondosylicitaciones.cl>'

export async function enviarEmail(opts: {
  to:      string
  subject: string
  html:    string
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('[email] RESEND_API_KEY no configurada')
    return false
  }

  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    FROM,
      to:      [opts.to],
      subject: opts.subject,
      html:    opts.html,
    }),
  })

  if (!res.ok) {
    console.error('[email] envío falló:', res.status, await res.text())
    return false
  }
  return true
}

// ── Templates ───────────────────────────────────────────────────────────────

const STYLE_BASE = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #0f172a; line-height: 1.6;
`

function shell(content: string): string {
  return `
    <div style="max-width:560px;margin:0 auto;padding:32px 24px;${STYLE_BASE}">
      <div style="text-align:center;margin-bottom:32px">
        <strong style="font-size:1.1rem;color:#0ea5e9">Fondos y Licitaciones</strong>
      </div>
      ${content}
      <div style="margin-top:40px;padding-top:24px;border-top:1px solid #e2e8f0;font-size:0.8rem;color:#64748b;text-align:center">
        Si tienes dudas, responde a este email o escríbenos a hola@fondosylicitaciones.cl
      </div>
    </div>
  `
}

// ── Plantillas de engagement (envío manual desde el admin) ───────────────────
// Cada plantilla recibe el nombre del usuario (o "" si no tiene) y devuelve
// asunto + html listos para enviar. Mantener las claves en sync con
// ENGAGEMENT_TEMPLATES del frontend (perfil de usuario admin).

const DASHBOARD_URL = 'https://app.fondosylicitaciones.cl/dashboard'

function saludo(nombre?: string | null): string {
  return nombre && nombre.trim() ? `Hola ${nombre.trim()},` : 'Hola,'
}

export type EngagementTemplateKey = 'te_extranamos' | 'completa_perfil' | 'novedades'

export const ENGAGEMENT_TEMPLATES: Record<EngagementTemplateKey, {
  label: string
  build: (nombre?: string | null) => { subject: string; html: string }
}> = {
  te_extranamos: {
    label: 'Te extrañamos',
    build: (nombre) => ({
      subject: 'Hace tiempo no te vemos en Fondos y Licitaciones',
      html: shell(`
        <h2 style="font-size:1.4rem;font-weight:700;margin:0 0 16px">Te extrañamos 👋</h2>
        <p>${saludo(nombre)}</p>
        <p>Notamos que hace un tiempo no entras a tu panel. Mientras tanto, han seguido apareciendo <strong>nuevas convocatorias y licitaciones</strong> que podrían calzar con tu perfil.</p>
        <p style="background:#f1f5f9;border-radius:10px;padding:16px;font-size:0.9rem;color:#475569;margin:24px 0">
          Entra y revisa tus matches más recientes — quizás haya una oportunidad esperándote.
        </p>
        <p><a href="${DASHBOARD_URL}" style="display:inline-block;background:#0ea5e9;color:white;text-decoration:none;padding:12px 24px;border-radius:9px;font-weight:600">Ver mis oportunidades</a></p>
      `),
    }),
  },
  completa_perfil: {
    label: 'Completa tu perfil',
    build: (nombre) => ({
      subject: 'Mejora tus resultados completando tu perfil',
      html: shell(`
        <h2 style="font-size:1.4rem;font-weight:700;margin:0 0 16px">Saca más provecho a tus alertas</h2>
        <p>${saludo(nombre)}</p>
        <p>Para que tus matches sean más precisos, te recomendamos completar tu <strong>configuración de alertas y tu proyecto</strong>: categorías, regiones, montos y palabras clave.</p>
        <p style="background:#f1f5f9;border-radius:10px;padding:16px;font-size:0.9rem;color:#475569;margin:24px 0">
          Mientras mejor definido esté tu perfil, mejores y más relevantes serán las convocatorias que te mostramos.
        </p>
        <p><a href="${DASHBOARD_URL}" style="display:inline-block;background:#0ea5e9;color:white;text-decoration:none;padding:12px 24px;border-radius:9px;font-weight:600">Completar mi perfil</a></p>
      `),
    }),
  },
  novedades: {
    label: 'Novedades de la plataforma',
    build: (nombre) => ({
      subject: 'Novedades en Fondos y Licitaciones',
      html: shell(`
        <h2 style="font-size:1.4rem;font-weight:700;margin:0 0 16px">Tenemos novedades para ti</h2>
        <p>${saludo(nombre)}</p>
        <p>Seguimos mejorando la plataforma para ayudarte a encontrar más y mejores oportunidades de financiamiento.</p>
        <p style="background:#f1f5f9;border-radius:10px;padding:16px;font-size:0.9rem;color:#475569;margin:24px 0">
          Entra a tu panel para ver las convocatorias activas y revisar tus matches.
        </p>
        <p><a href="${DASHBOARD_URL}" style="display:inline-block;background:#0ea5e9;color:white;text-decoration:none;padding:12px 24px;border-radius:9px;font-weight:600">Ir a mi panel</a></p>
      `),
    }),
  },
}
