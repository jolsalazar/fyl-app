// Rescate de enlaces de seguimiento de Resend (click tracking) que quedaron rotos.
//
// CONTEXTO: un broadcast de Resend se envió con el "tracking subdomain" apuntando
// a app.fondosylicitaciones.cl. Resend (vía Amazon SES) reescribe cada enlace del
// correo a la forma:
//
//   https://app.fondosylicitaciones.cl/CL0/<url-real-url-encoded>/1/<msg-id>/<firma>=NNN
//
// Para que ese /CL0/... funcione, el dominio tendría que apuntar a los servidores
// de tracking de Resend; pero app.fondosylicitaciones.cl apunta a NUESTRA app
// (Cloudflare Pages), así que todos esos clics caían en 404. La config de Resend
// ya se corrigió a links.fondosylicitaciones.cl para envíos futuros, PERO el correo
// ya enviado no se puede des-enviar: sus enlaces siguen llegando acá.
//
// Como esos clics llegan a nuestra app igual, los interceptamos: decodificamos la
// URL real que va embebida en el path y redirigimos (302). Se pierde la métrica de
// clics de ese envío, pero el enlace deja de estar roto.
//
// SEGURIDAD: para no convertir el dominio en un open-redirect (phishing), solo se
// redirige a hosts propios (*.fondosylicitaciones.cl) y al unsubscribe de Resend.
// Cualquier otra cosa devuelve 404.

// El segmento de URL embebido va url-encoded (las "/" reales son %2F), por lo que
// el primer "/" literal tras /CL0/ marca el fin de la URL. Nitro entrega event.path
// sin decodificar %2F, así que este regex captura justo la porción codificada.
const ENCODED_URL_RE = /^\/CL0\/([^/]+)\//

function hostPermitido(host: string): boolean {
  const h = host.toLowerCase()
  return (
    h === 'fondosylicitaciones.cl' ||
    h.endsWith('.fondosylicitaciones.cl') ||
    h === 'resend.com' ||
    h.endsWith('.resend.com')
  )
}

export default defineEventHandler((event) => {
  const match = ENCODED_URL_RE.exec(event.path)
  if (!match) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  let destino: URL
  try {
    destino = new URL(decodeURIComponent(match[1]))
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const protoOk = destino.protocol === 'https:' || destino.protocol === 'http:'
  if (!protoOk || !hostPermitido(destino.hostname)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  return sendRedirect(event, destino.toString(), 302)
})
