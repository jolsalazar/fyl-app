// Crea una suscripción recurrente en MercadoPago y redirige al checkout.
// Endpoint: /api/mercadopago/create-preapproval (suscripción mensual con auto-renovación).
// Si tiene precio promocional, MP cobra el monto promo los primeros 90 días y un cron
// hace el cambio automático al precio regular después (Fase 3).

export function useContratarPlan() {
  const { show: toast } = useToast()

  async function contratar(plan: 'starter' | 'advanced' | 'agency') {
    try {
      const res = await $fetch<{ ok: boolean; init_point?: string; error?: string }>(
        '/api/mercadopago/create-preapproval',
        { method: 'POST', body: { plan } },
      )
      if (res.ok && res.init_point) {
        window.location.href = res.init_point
        return true
      }
      toast('No se pudo iniciar la suscripción. Intenta nuevamente o escríbenos.', 'error')
      return false
    } catch {
      toast('No se pudo iniciar la suscripción. Intenta nuevamente o escríbenos.', 'error')
      return false
    }
  }

  return { contratar }
}
