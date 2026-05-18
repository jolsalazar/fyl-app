// Tarifas de MercadoPago Chile para Suscripciones (Preapproval) con liberación
// inmediata. Calibrado empíricamente al 2026-05-17 con un cobro real:
//   bruto: $5990 → neto recibido: $5762 → fee total: $228 (3.808%)
//
// Desglose: 3.2% fee base + 19% IVA Chile sobre el fee = 3.808% efectivo.
//   5990 * 0.032           = 191.68  (fee base)
//   191.68 * 1.19          = 228.10  (fee + IVA)
//   5990 - 228.10          = 5761.90 → redondea a 5762
//
// IMPORTANTE: estas constantes son SOLO para estimar MRR neto proyectado.
// Para cobros reales que ya están en la tabla public.payments, usar siempre
// los valores `fee_amount`, `taxes_amount` y `net_received_amount` que vienen
// directo de MP (campo `fee_details[]` y `transaction_details.net_received_amount`).
//
// Si MP renegocia tu tarifa o ofrece descuento por volumen, actualizar
// MP_CL_FEE_RATE_BASE y volver a verificar contra un cobro reciente.

export const MP_CL_FEE_RATE_BASE = 0.032  // 3.2% comisión MP Chile preapproval
export const MP_CL_IVA_RATE      = 0.19   // 19% IVA Chile sobre la comisión

/** Tasa efectiva total (fee + IVA), útil para mostrar "MP se queda con X%". */
export const MP_CL_FEE_RATE_EFFECTIVE = MP_CL_FEE_RATE_BASE * (1 + MP_CL_IVA_RATE)

/** Calcula la comisión base (sin IVA) sobre un monto bruto en CLP. */
export function feeBase(grossAmount: number): number {
  return Math.round(grossAmount * MP_CL_FEE_RATE_BASE)
}

/** Calcula el IVA sobre la comisión MP. */
export function feeIva(grossAmount: number): number {
  return Math.round(feeBase(grossAmount) * MP_CL_IVA_RATE)
}

/** Calcula el monto neto que recibe el vendedor tras fee + IVA. */
export function netAmount(grossAmount: number): number {
  return grossAmount - feeBase(grossAmount) - feeIva(grossAmount)
}
