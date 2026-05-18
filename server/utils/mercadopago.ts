// Helpers para integración con MercadoPago.
// La validación de firma es CRÍTICA: sin esto, cualquiera puede enviar un POST a
// /api/mercadopago/webhook fingiendo un pago aprobado y obtener un plan gratis.
//
// Doc: https://www.mercadopago.cl/developers/es/docs/your-integrations/notifications/webhooks#firmasecreta

const PLANES_VALIDOS = ['free', 'starter', 'advanced', 'agency'] as const
export type Plan = typeof PLANES_VALIDOS[number]

export function esPlanValido(p: string): p is Plan {
  return (PLANES_VALIDOS as readonly string[]).includes(p)
}

// Tolerancia de timestamp para anti-replay. MP firma con `ts` y rechazamos
// firmas más viejas (o más nuevas — clock skew) que esto. Si MP firma una
// vez y reintenta múltiples veces con el MISMO header firmado, una ventana
// muy chica corta los retries legítimos. 15 min es un compromiso razonable.
const FIRMA_TOLERANCIA_SEGUNDOS = 900 // 15 minutos

/**
 * Verifica la firma `x-signature` que MercadoPago envía con cada webhook.
 *
 * El header viene como: `ts=<timestamp>,v1=<hash hex>`
 * El template firmado es:   `id:<dataId>;request-id:<xRequestId>;ts:<ts>;`
 * Donde dataId proviene de los QUERY PARAMS (?data.id=...), NO del body JSON.
 * El HMAC-SHA256 usa el webhook secret configurado en el panel de MP.
 */
export async function verificarFirmaMercadoPago(opts: {
  signatureHeader: string | undefined | null
  requestId:       string | undefined | null
  dataId:          string
  secret:          string
}): Promise<boolean> {
  const { signatureHeader, requestId, dataId, secret } = opts
  if (!signatureHeader || !requestId || !dataId || !secret) return false

  const partes = Object.fromEntries(
    signatureHeader.split(',').map(p => {
      const [k, ...rest] = p.trim().split('=')
      return [k, rest.join('=')]
    }),
  ) as { ts?: string; v1?: string }

  if (!partes.ts || !partes.v1) return false

  // Anti-replay: rechazar firmas fuera de la ventana de tolerancia.
  const tsNum = parseInt(partes.ts, 10)
  if (isNaN(tsNum)) return false
  const nowSec = Math.floor(Date.now() / 1000)
  if (Math.abs(nowSec - tsNum) > FIRMA_TOLERANCIA_SEGUNDOS) return false

  // MP firma con `data.id` en lowercase cuando es alfanumérico (preapprovals).
  // Doc: "if the data.id_url is alphanumeric, it must be sent in lowercase".
  const template = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${partes.ts};`

  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(template))
  const hex = [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('')

  // Comparación timing-safe básica
  if (hex.length !== partes.v1.length) return false
  let diff = 0
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ partes.v1.charCodeAt(i)
  return diff === 0
}

/** Llama a la API de MP para obtener el detalle del pago. */
export async function obtenerPagoMercadoPago(paymentId: string, accessToken: string) {
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  return res.json() as Promise<{
    id:                 number
    status:             string  // 'approved' | 'pending' | 'rejected' | ...
    status_detail:      string
    external_reference: string  // formato esperado: `${user_id}:${plan}`
    payer?:             { email?: string }
    transaction_amount: number
    date_created?:      string  // ISO timestamp
    date_approved?:     string  // ISO timestamp (null hasta que se aprueba)
  }>
}

/** Asigna un plan a un usuario llamando a la RPC admin_set_user_plan con service_role. */
export async function asignarPlanUsuario(opts: {
  supabaseUrl:        string
  serviceRoleKey:     string
  userId:             string
  plan:               Plan
}): Promise<boolean> {
  const res = await fetch(`${opts.supabaseUrl}/rest/v1/rpc/admin_set_user_plan`, {
    method:  'POST',
    headers: {
      apikey:         opts.serviceRoleKey,
      Authorization:  `Bearer ${opts.serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ target_id: opts.userId, new_plan: opts.plan }),
  })
  return res.ok
}

/** Obtiene el detalle de una preapproval (suscripción) desde MP. */
export async function obtenerPreapprovalMercadoPago(preapprovalId: string, accessToken: string) {
  const res = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  return res.json() as Promise<{
    id:                 string
    status:             string  // 'pending' | 'authorized' | 'paused' | 'cancelled'
    payer_email:        string
    external_reference: string  // formato: "user_id:plan"
    auto_recurring: {
      transaction_amount: number
      currency_id:        string
      frequency:          number
      frequency_type:     string
    }
    next_payment_date?: string
    date_created?:      string
  }>
}

/** Cancela una preapproval en MP. La doc oficial alterna entre `cancelled` y `canceled`; probamos ambos. */
export async function cancelarPreapprovalMercadoPago(preapprovalId: string, accessToken: string) {
  async function request(status: 'cancelled' | 'canceled') {
    const res = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      method:  'PUT',
      headers: {
        Authorization:  `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    })
    return {
      ok:     res.ok,
      status: res.status,
      body:   res.ok ? '' : await res.text().catch(() => ''),
    }
  }

  const first = await request('cancelled')
  if (first.ok) return first

  const second = await request('canceled')
  return second.ok ? second : first
}

/** Obtiene el detalle de un authorized_payment (cobro mensual de una suscripción). */
export async function obtenerAuthorizedPaymentMercadoPago(paymentId: string, accessToken: string) {
  const res = await fetch(`https://api.mercadopago.com/authorized_payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  return res.json() as Promise<{
    id:              number
    preapproval_id:  string
    status:          string  // 'approved' | 'rejected' | 'pending' | ...
    transaction_amount: number
    payment?:        { id?: number; status?: string }
  }>
}

/** Actualiza una subscription en BD vía REST con service_role (bypass RLS). */
export async function actualizarSuscripcion(opts: {
  supabaseUrl:    string
  serviceRoleKey: string
  preapprovalId:  string
  patch:          Record<string, unknown>
}): Promise<boolean> {
  const url = `${opts.supabaseUrl}/rest/v1/subscriptions?mp_preapproval_id=eq.${encodeURIComponent(opts.preapprovalId)}`
  const res = await fetch(url, {
    method:  'PATCH',
    headers: {
      apikey:         opts.serviceRoleKey,
      Authorization:  `Bearer ${opts.serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer:         'return=minimal',
    },
    body: JSON.stringify(opts.patch),
  })
  return res.ok
}

/**
 * Elimina el registro de evento procesado — rollback cuando el handler falla.
 * Sin esto, MP reintentaría con el mismo event_id y nosotros ignoraríamos
 * como duplicado, perdiendo activaciones/cancelaciones.
 */
export async function eliminarEventoProcesado(opts: {
  supabaseUrl:    string
  serviceRoleKey: string
  provider:       string
  eventType:      string
  eventId:        string
}): Promise<void> {
  const url = `${opts.supabaseUrl}/rest/v1/webhook_events_processed` +
    `?provider=eq.${encodeURIComponent(opts.provider)}` +
    `&event_type=eq.${encodeURIComponent(opts.eventType)}` +
    `&event_id=eq.${encodeURIComponent(opts.eventId)}`
  await fetch(url, {
    method:  'DELETE',
    headers: {
      apikey:        opts.serviceRoleKey,
      Authorization: `Bearer ${opts.serviceRoleKey}`,
      Prefer:        'return=minimal',
    },
  }).catch(err => console.error('[webhook] eliminarEventoProcesado fallo:', err))
}

/**
 * Marca un evento de webhook como procesado. Devuelve true si era nuevo,
 * false si ya estaba registrado (duplicado — el caller debe ignorar el evento).
 *
 * Idempotencia: usa INSERT ... ON CONFLICT DO NOTHING. Si el array devuelto
 * por PostgREST está vacío, el evento ya existía.
 */
export async function registrarEventoProcesado(opts: {
  supabaseUrl:    string
  serviceRoleKey: string
  provider:       string
  eventType:      string
  eventId:        string
}): Promise<boolean> {
  const res = await fetch(`${opts.supabaseUrl}/rest/v1/webhook_events_processed`, {
    method:  'POST',
    headers: {
      apikey:         opts.serviceRoleKey,
      Authorization:  `Bearer ${opts.serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer:         'resolution=ignore-duplicates,return=representation',
    },
    body: JSON.stringify({
      provider:   opts.provider,
      event_type: opts.eventType,
      event_id:   opts.eventId,
    }),
  })

  if (!res.ok) {
    // Si la tabla no existe (migración no aplicada) o falla por otro motivo,
    // procesamos el evento de todos modos (fail-open). El caller decide.
    console.error('[webhook] registrarEventoProcesado fallo:', res.status, await res.text())
    return true
  }

  const rows = await res.json() as unknown[]
  return rows.length > 0  // true = nuevo, false = duplicado
}

/** Lee una subscription por preapproval_id (devuelve null si no existe). */
export async function obtenerSuscripcion(opts: {
  supabaseUrl:    string
  serviceRoleKey: string
  preapprovalId:  string
}) {
  const url = `${opts.supabaseUrl}/rest/v1/subscriptions?mp_preapproval_id=eq.${encodeURIComponent(opts.preapprovalId)}&select=*`
  const res = await fetch(url, {
    headers: {
      apikey:         opts.serviceRoleKey,
      Authorization:  `Bearer ${opts.serviceRoleKey}`,
    },
  })
  if (!res.ok) return null
  const rows = await res.json() as Array<{
    id:                string
    user_id:           string
    plan:              Plan
    mp_preapproval_id: string
    status:            string
    current_amount:    number
    regular_amount:    number
    promo_applied:     boolean
    promo_ends_at:     string | null
    failed_payments:   number
    cancel_reason:     'user' | 'upgrade' | 'failed_payments' | null
  }>
  return rows[0] ?? null
}
