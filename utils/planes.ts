// Configuración única de planes — fuente de verdad para precios y nombres.
// Usado por: planes.vue (UI), create-preapproval.post.ts (suscripción), registro.vue (badge),
// onboarding.vue (intención), web Astro (display + JSON-LD).
//
// Convención de promo: Starter y Advanced tienen precio promocional durante los
// primeros 90 días. Pasado ese plazo, el cron actualiza el monto en MercadoPago
// al precio regular (ver Fase 2 — suscripciones).

export const DURACION_PROMO_DIAS = 90

type PlanSinPromo = {
  nombre: string
  icon: string
  precio: number
  tiene_promo: false
}

type PlanConPromo = {
  nombre: string
  icon: string
  precio_promo: number
  precio_regular: number
  duracion_promo_dias: number
  tiene_promo: true
}

export const PLANES_CONFIG = {
  free: {
    nombre: 'Free',
    icon: '🌱',
    precio: 0,
    tiene_promo: false,
  } satisfies PlanSinPromo,

  starter: {
    nombre: 'Starter',
    icon: '🚀',
    precio_promo: 5990,
    precio_regular: 8990,
    duracion_promo_dias: DURACION_PROMO_DIAS,
    tiene_promo: true,
  } satisfies PlanConPromo,

  advanced: {
    nombre: 'Advanced',
    icon: '⭐',
    precio_promo: 19990,
    precio_regular: 29990,
    duracion_promo_dias: DURACION_PROMO_DIAS,
    tiene_promo: true,
  } satisfies PlanConPromo,

  agency: {
    nombre: 'Agency',
    icon: '🏢',
    precio: 59990,
    tiene_promo: false,
  } satisfies PlanSinPromo,
} as const

export type Plan = keyof typeof PLANES_CONFIG

export function esPlanValido(p: unknown): p is Plan {
  return typeof p === 'string' && p in PLANES_CONFIG
}

export function getNombrePlan(plan: Plan): string {
  return PLANES_CONFIG[plan].nombre
}

/** Precio que el usuario pagará al contratar (incluye descuento promo si aplica). */
export function getPrecioInicial(plan: Plan): number {
  const cfg = PLANES_CONFIG[plan]
  return cfg.tiene_promo ? cfg.precio_promo : cfg.precio
}

/** Precio regular (post-promo). Para planes sin promo, es el mismo precio. */
export function getPrecioRegular(plan: Plan): number {
  const cfg = PLANES_CONFIG[plan]
  return cfg.tiene_promo ? cfg.precio_regular : cfg.precio
}

export function tienePromo(plan: Plan): boolean {
  return PLANES_CONFIG[plan].tiene_promo
}
