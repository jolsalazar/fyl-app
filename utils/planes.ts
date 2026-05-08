export const PLANES_CONFIG = {
  free: {
    nombre: 'Free',
    precio: 0,
    icon: '🌱',
  },
  starter: {
    nombre: 'Starter',
    precio: 5990,
    icon: '🚀',
  },
  advanced: {
    nombre: 'Advanced',
    precio: 19990,
    icon: '⭐',
  },
  agency: {
    nombre: 'Agency',
    precio: 49990,
    icon: '🏢',
  },
} as const

export type Plan = keyof typeof PLANES_CONFIG

export function esPlanValido(p: unknown): p is Plan {
  return typeof p === 'string' && p in PLANES_CONFIG
}

export function getNombrePlan(plan: Plan): string {
  return PLANES_CONFIG[plan].nombre
}

export function getPrecioPlan(plan: Plan): number {
  return PLANES_CONFIG[plan].precio
}
