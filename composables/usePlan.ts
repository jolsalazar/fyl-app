type Plan = 'free' | 'starter' | 'pro' | 'agencia'

interface PlanConfig {
  maxAlertas:    number   // -1 = ilimitado
  emailAlertas:  boolean
  match:         boolean
  multiCliente:  boolean
}

const PLAN_CONFIG: Record<Plan, PlanConfig> = {
  free:    { maxAlertas: 1,  emailAlertas: false, match: false, multiCliente: false },
  starter: { maxAlertas: 3,  emailAlertas: true,  match: true,  multiCliente: false },
  pro:     { maxAlertas: -1, emailAlertas: true,  match: true,  multiCliente: false },
  agencia: { maxAlertas: -1, emailAlertas: true,  match: true,  multiCliente: true  },
}

const PLAN_LABELS: Record<Plan, string> = {
  free:    'Gratuito',
  starter: 'Starter',
  pro:     'Pro',
  agencia: 'Agencia',
}

const PLAN_ORDER: Plan[] = ['free', 'starter', 'pro', 'agencia']

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
      .select('plan')
      .eq('id', user.id)
      .single()
    _plan.value    = (data?.plan ?? 'free') as Plan
    _loading.value = false
    _loaded.value  = true
  }

  const config  = computed(() => PLAN_CONFIG[_plan.value])
  const label   = computed(() => PLAN_LABELS[_plan.value])

  // Feature flags
  const canUseMatch        = computed(() => config.value.match)
  const canUseEmail        = computed(() => config.value.emailAlertas)
  const canUseMultiCliente = computed(() => config.value.multiCliente)
  const maxAlertas         = computed(() => config.value.maxAlertas)

  // Helpers
  function canAddAlerta(currentCount: number): boolean {
    if (config.value.maxAlertas === -1) return true
    return currentCount < config.value.maxAlertas
  }

  function planRequerido(feature: 'match' | 'email' | 'multiCliente'): string {
    const map = {
      match:        'Pro',
      email:        'Starter',
      multiCliente: 'Agencia',
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
    planRequerido,
    esMejor,
    load,
    reset,
  }
}
