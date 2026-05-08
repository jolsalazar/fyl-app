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

/** Email de aviso: la promo de 3 meses termina en X días. */
export function emailAvisoPromo(opts: {
  nombrePlan:    string
  precioRegular: number
  diasRestantes: number
  fechaCambio:   string  // formato dd/mm/yyyy
}): { subject: string; html: string } {
  const subject = `Tu plan ${opts.nombrePlan} pasa a precio regular en ${opts.diasRestantes} días`
  const html = shell(`
    <h2 style="font-size:1.4rem;font-weight:700;margin:0 0 16px">Tu período promocional termina pronto</h2>
    <p>Te avisamos con anticipación: el <strong>${opts.fechaCambio}</strong> termina el período promocional de tu plan <strong>${opts.nombrePlan}</strong>.</p>
    <p>A partir de esa fecha, el cobro mensual pasa a <strong>$${opts.precioRegular.toLocaleString('es-CL')}/mes</strong> (precio regular).</p>
    <p style="background:#f1f5f9;border-radius:10px;padding:16px;font-size:0.9rem;color:#475569;margin:24px 0">
      No tienes que hacer nada. El cambio se aplica automáticamente y MercadoPago seguirá cobrando como hasta ahora, solo que con el nuevo monto.
    </p>
    <p>Si quieres cancelar antes del cambio, puedes hacerlo desde tu <a href="https://app.fondosylicitaciones.cl/dashboard" style="color:#0ea5e9">panel</a> o respondiendo este email.</p>
  `)
  return { subject, html }
}

/** Email de confirmación: el cambio de precio ya se aplicó. */
export function emailCambioPromoAplicado(opts: {
  nombrePlan:    string
  precioRegular: number
}): { subject: string; html: string } {
  const subject = `Tu plan ${opts.nombrePlan} ahora cobra el precio regular`
  const html = shell(`
    <h2 style="font-size:1.4rem;font-weight:700;margin:0 0 16px">Cambio de precio aplicado</h2>
    <p>Como te avisamos, el período promocional de tu plan <strong>${opts.nombrePlan}</strong> terminó.</p>
    <p>A partir del próximo cobro mensual, el monto será de <strong>$${opts.precioRegular.toLocaleString('es-CL')}/mes</strong>.</p>
    <p style="background:#f1f5f9;border-radius:10px;padding:16px;font-size:0.9rem;color:#475569;margin:24px 0">
      Tu suscripción sigue activa con todos los beneficios. No hay que hacer nada de tu lado.
    </p>
    <p>Si quieres cambiar o cancelar tu plan, entra a tu <a href="https://app.fondosylicitaciones.cl/dashboard" style="color:#0ea5e9">panel</a> cuando quieras.</p>
  `)
  return { subject, html }
}
