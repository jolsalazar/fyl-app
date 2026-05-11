type Plan = 'free' | 'starter' | 'advanced' | 'agency'

interface PlanConfig {
  maxAlertas:    number   // -1 = ilimitado
  maxProyectos:  number
  emailAlertas:  boolean
  match:         boolean
  multiCliente:  boolean
}

const PLAN_CONFIG: Record<Plan, PlanConfig> = {
  free:     { maxAlertas: 1,  maxProyectos: 1,  emailAlertas: false, match: false, multiCliente: false },
  starter:  { maxAlertas: 3,  maxProyectos: 3,  emailAlertas: true,  match: true,  multiCliente: false },
  advanced: { maxAlertas: -1, maxProyectos: -1, emailAlertas: true,  match: true,  multiCliente: false },
  agency:   { maxAlertas: -1, maxProyectos: -1, emailAlertas: true,  match: true,  multiCliente: true  },
}

const PLAN_LABELS: Record<Plan, string> = {
  free:     'Free',
  starter:  'Starter',
  advanced: 'Advanced',
  agency:   'Agency',
}

const PLAN_ORDER: Plan[] = ['free', 'starter', 'advanced', 'agency']

// Estado global — se carga una sola vez por sesión
const _plan     = ref<Plan>('free')
const _loading  = ref(true)
const _loaded   = ref(false)

export function usePlan() {
  const supabase = useSupabaseClient()

  async function load() {
    if (_loaded.value) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { _loading.value = false; return }
    const { data } = await supabase
      .from('profiles')
      .select('plan, plan_expires_at')
      .eq('id', user.id)
      .maybeSingle()

    // Normalizar nombres viejos por si la migración no corrió en producción
    const LEGACY: Record<string, Plan> = { pro: 'advanced', agencia: 'agency' }
    const raw = data?.plan ?? 'free'
    const normalized = (LEGACY[raw] ?? (raw in PLAN_CONFIG ? raw : 'free')) as Plan
    const expired = Boolean(
      data?.plan_expires_at &&
      new Date(data.plan_expires_at).getTime() <= Date.now() &&
      normalized !== 'free',
    )
    _plan.value    = expired ? 'free' : normalized
    _loading.value = false
    _loaded.value  = true
  }

  const config  = computed(() => PLAN_CONFIG[_plan.value] ?? PLAN_CONFIG.free)
  const label   = computed(() => PLAN_LABELS[_plan.value])

  // Feature flags
  const canUseMatch        = computed(() => config.value.match)
  const canUseEmail        = computed(() => config.value.emailAlertas)
  const canUseMultiCliente = computed(() => config.value.multiCliente)
  const maxAlertas         = computed(() => config.value.maxAlertas)
  const maxProyectos       = computed(() => config.value.maxProyectos)

  // Helpers
  function canAddAlerta(currentCount: number): boolean {
    if (config.value.maxAlertas === -1) return true
    return currentCount < config.value.maxAlertas
  }

  function canAddProyecto(currentCount: number): boolean {
    if (config.value.maxProyectos === -1) return true
    return currentCount < config.value.maxProyectos
  }

  const filtersAvanzados = computed(() => _plan.value !== 'free')

  function planRequerido(feature: 'match' | 'email' | 'multiCliente'): string {
    const map = {
      match:        'Advanced',
      email:        'Starter',
      multiCliente: 'Agency',
    }
    return map[feature]
  }

  function esMejor(otroPlan: Plan): boolean {
    return PLAN_ORDER.indexOf(otroPlan) > PLAN_ORDER.indexOf(_plan.value)
  }

  function reset() {
    _plan.value    = 'free'
    _loaded.value  = false
    _loading.value = true
  }

  return {
    plan:            readonly(_plan),
    loading:         readonly(_loading),
    label,
    config,
    canUseMatch,
    canUseEmail,
    canUseMultiCliente,
    maxAlertas,
    canAddAlerta,
    canAddProyecto,
    filtersAvanzados,
    maxProyectos,
    planRequerido,
    esMejor,
    load,
    reset,
  }
}
