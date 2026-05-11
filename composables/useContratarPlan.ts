// Crea un pago mensual NO recurrente en MercadoPago y redirige al checkout.
// Endpoint: /api/mercadopago/create-preference (Checkout Pro pago único).

export function useContratarPlan() {
  const { show: toast } = useToast()

  async function contratar(plan: 'starter' | 'advanced' | 'agency') {
    try {
      const res = await $fetch<{ ok: boolean; init_point?: string; error?: string }>(
        '/api/mercadopago/create-preference',
        { method: 'POST', body: { plan } },
      )
      if (res.ok && res.init_point) {
        window.location.href = res.init_point
        return true
      }
      toast('No se pudo iniciar el pago. Intenta nuevamente o escríbenos.', 'error')
      return false
    } catch {
      toast('No se pudo iniciar el pago. Intenta nuevamente o escríbenos.', 'error')
      return false
    }
  }

  return { contratar }
}
