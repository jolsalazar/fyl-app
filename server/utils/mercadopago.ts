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

/**
 * Verifica la firma `x-signature` que MercadoPago envía con cada webhook.
 *
 * El header viene como: `ts=<timestamp>,v1=<hash hex>`
 * El template firmado es:   `id:<dataId>;request-id:<xRequestId>;ts:<ts>;`
 * y el HMAC-SHA256 usa el webhook secret configurado en el panel de MP.
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

  const template = `id:${dataId};request-id:${requestId};ts:${partes.ts};`

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
  }>
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
  }>
  return rows[0] ?? null
}
