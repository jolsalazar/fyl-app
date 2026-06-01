// Configuración única de planes — fuente de verdad para precios y nombres.
// Usado por: planes.vue (UI), create-preapproval.post.ts (suscripción), registro.vue (badge),
// onboarding.vue (intención), web Astro (display + JSON-LD).
//
// Todos los planes tienen precio único y permanente (sin promo a 90 días).

type PlanConfig = {
  nombre: string
  icon: string
  precio: number
  tiene_promo: false
}

export const PLANES_CONFIG = {
  free: {
    nombre: 'Free',
    icon: '🌱',
    precio: 0,
    tiene_promo: false,
  } satisfies PlanConfig,

  starter: {
    nombre: 'Starter',
    icon: '🚀',
    precio: 5990,
    tiene_promo: false,
  } satisfies PlanConfig,

  advanced: {
    nombre: 'Advanced',
    icon: '⭐',
    precio: 19990,
    tiene_promo: false,
  } satisfies PlanConfig,

  agency: {
    nombre: 'Agency',
    icon: '🏢',
    precio: 59990,
    tiene_promo: false,
  } satisfies PlanConfig,
} as const

export type Plan = keyof typeof PLANES_CONFIG

export function esPlanValido(p: unknown): p is Plan {
  return typeof p === 'string' && p in PLANES_CONFIG
}

export function getNombrePlan(plan: Plan): string {
  return PLANES_CONFIG[plan].nombre
}

/** Precio que el usuario pagará al contratar. */
export function getPrecioInicial(plan: Plan): number {
  return PLANES_CONFIG[plan].precio
}

/** Precio regular. Igual al inicial: ya no hay promo a 90 días. */
export function getPrecioRegular(plan: Plan): number {
  return PLANES_CONFIG[plan].precio
}

export function tienePromo(plan: Plan): boolean {
  return PLANES_CONFIG[plan].tiene_promo
}
