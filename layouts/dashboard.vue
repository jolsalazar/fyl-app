<template>
  <div class="shell">

    <!-- Navbar -->
    <header class="navbar">
      <div class="navbar-left">
        <button class="hamburger" @click="sidebarOpen = true" aria-label="Abrir menú">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <NuxtLink to="/dashboard" class="brand">
          <img src="~/assets/images/logo-light.png" alt="Fondos y Licitaciones" class="brand-logo" />
        </NuxtLink>
      </div>

      <div class="navbar-right">
        <span v-if="planLabel" class="plan-badge" :class="planClass">{{ planLabel }}</span>

        <div class="user-menu" @click="menuOpen = !menuOpen" v-click-outside="() => menuOpen = false">
          <div class="avatar">{{ inicial }}</div>
          <span class="user-email-nav">{{ email }}</span>
          <svg class="chevron-nav" :class="{ open: menuOpen }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>

        <Transition name="dropdown">
          <div v-if="menuOpen" class="dropdown">
            <div class="dropdown-header">
              <div class="avatar avatar-lg">{{ inicial }}</div>
              <div>
                <div class="dropdown-email">{{ email }}</div>
                <div class="dropdown-plan">Plan {{ planLabel }}</div>
              </div>
            </div>
            <div class="dropdown-divider"></div>
            <NuxtLink to="/dashboard/mi-perfil" class="dropdown-item" @click="menuOpen = false">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              Mis Proyectos
            </NuxtLink>
            <NuxtLink to="/dashboard/suscripcion" class="dropdown-item" @click="menuOpen = false">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
              Suscripción
            </NuxtLink>
            <NuxtLink to="/dashboard/configuracion" class="dropdown-item" @click="menuOpen = false">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              Configuración
            </NuxtLink>
            <NuxtLink v-if="planLabel === 'Free'" to="/planes" class="dropdown-item dropdown-upgrade" @click="menuOpen = false">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
              Mejorar plan
            </NuxtLink>
            <div class="dropdown-divider"></div>
            <button class="dropdown-item dropdown-logout" @click="logout">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Cerrar sesión
            </button>
          </div>
        </Transition>
      </div>
    </header>

    <!-- Overlay mobile -->
    <div class="overlay" v-if="sidebarOpen" @click="sidebarOpen = false"></div>

    <!-- Sidebar -->
    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <button class="sidebar-close" @click="sidebarOpen = false" aria-label="Cerrar menú">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>

      <nav class="nav">
        <NuxtLink to="/dashboard" class="nav-item" exact-active-class="active" @click="sidebarOpen = false">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          Fondos
          <span v-if="nuevas > 0" class="nav-badge">{{ nuevas > 99 ? '99+' : nuevas }}</span>
        </NuxtLink>
        <NuxtLink to="/dashboard/licitaciones" class="nav-item" active-class="active" @click="sidebarOpen = false">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          Licitaciones
          <span v-if="nuevasLicitaciones > 0" class="nav-badge">{{ nuevasLicitaciones > 99 ? '99+' : nuevasLicitaciones }}</span>
        </NuxtLink>
        <NuxtLink to="/dashboard/guardados" class="nav-item" active-class="active" @click="sidebarOpen = false">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          Guardados
          <span v-if="totalGuardados > 0" class="nav-count">{{ totalGuardados }}</span>
        </NuxtLink>
        <NuxtLink to="/dashboard/postulaciones" class="nav-item" active-class="active" @click="sidebarOpen = false">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          Postulaciones
        </NuxtLink>
        <NuxtLink to="/dashboard/calendario" class="nav-item" active-class="active" @click="sidebarOpen = false">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Calendario
        </NuxtLink>
        <NuxtLink to="/dashboard/alertas" class="nav-item" active-class="active" @click="sidebarOpen = false">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6.002 6.002 0 0 0-4-5.659V5a2 2 0 1 0-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"/></svg>
          Mis alertas
          <span v-if="alertasNuevas > 0" class="nav-badge">{{ alertasNuevas > 99 ? '99+' : alertasNuevas }}</span>
        </NuxtLink>
        <NuxtLink to="/dashboard/estadisticas" class="nav-item" active-class="active" @click="sidebarOpen = false">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          Estadísticas
        </NuxtLink>
        <NuxtLink to="/dashboard/match" class="nav-item nav-match" active-class="active" @click="sidebarOpen = false">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          Mis Match
          <span class="nav-pro">Pro</span>
        </NuxtLink>

        <template v-if="isAdmin">
          <div class="nav-divider"></div>
          <button class="nav-admin-toggle" @click="adminExpanded = !adminExpanded">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Admin
            <svg class="chevron" :class="{ open: adminExpanded }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <template v-if="adminExpanded">
            <NuxtLink to="/dashboard/admin/usuarios" class="nav-item nav-sub" active-class="active" @click="sidebarOpen = false">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Usuarios
            </NuxtLink>
            <NuxtLink to="/dashboard/admin/fuentes" class="nav-item nav-sub" active-class="active" @click="sidebarOpen = false">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
              Fuentes
            </NuxtLink>
            <NuxtLink to="/dashboard/admin/metricas" class="nav-item nav-sub" active-class="active" @click="sidebarOpen = false">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              Métricas
            </NuxtLink>
            <NuxtLink to="/dashboard/admin/finanzas" class="nav-item nav-sub" active-class="active" @click="sidebarOpen = false">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              Finanzas
            </NuxtLink>
          </template>
        </template>
      </nav>
    </aside>

    <!-- Main -->
    <main class="main">
      <slot />
    </main>

    <AppToast />
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient()
const router = useRouter()
const { plan, label: planLabel, load: loadPlan, reset: resetPlan } = usePlan()

const email        = ref('')
const isAdmin      = ref(false)
const adminExpanded = ref(false)
const menuOpen     = ref(false)
const sidebarOpen  = ref(false)
const nuevas            = ref(0)
const nuevasLicitaciones = ref(0)
const totalGuardados    = ref(0)
const alertasNuevas     = ref(0)
const inicial = computed(() => email.value?.[0]?.toUpperCase() ?? '?')

const planClass = computed(() => ({
  'badge-free':    plan.value === 'free',
  'badge-starter': plan.value === 'starter',
  'badge-advanced': plan.value === 'advanced',
  'badge-agency':   plan.value === 'agency',
}))

// Directive para cerrar dropdown al clickear afuera
const vClickOutside = {
  mounted(el: HTMLElement, binding: any) {
    el._clickOutside = (e: MouseEvent) => {
      if (!el.contains(e.target as Node)) binding.value(e)
    }
    document.addEventListener('click', el._clickOutside)
  },
  unmounted(el: HTMLElement) {
    document.removeEventListener('click', el._clickOutside)
  },
}

onMounted(async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  email.value = user.email ?? ''

  const [{ data: profile }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    loadPlan(),
  ])
  isAdmin.value = profile?.role === 'admin'

  const lastVisit = localStorage.getItem('fyl_last_visit')
  if (lastVisit) {
    const hoy = new Date().toISOString().split('T')[0]
    const [{ count: cFondos }, { count: cLicit }] = await Promise.all([
      supabase.from('convocatorias').select('id', { count: 'exact', head: true })
        .gt('fecha_scrapeado', lastVisit).eq('estado', 'abierto').neq('fuente', 'mercadopublico')
        .or(`fecha_cierre_postulacion.gte.${hoy},fecha_cierre_postulacion.is.null`),
      supabase.from('convocatorias').select('id', { count: 'exact', head: true })
        .gt('fecha_scrapeado', lastVisit).eq('estado', 'abierto').eq('fuente', 'mercadopublico')
        .or(`fecha_cierre_postulacion.gte.${hoy},fecha_cierre_postulacion.is.null`),
    ])
    nuevas.value = cFondos ?? 0
    nuevasLicitaciones.value = cLicit ?? 0
  }

  const { count: cGuardados } = await supabase
    .from('guardados').select('id', { count: 'exact', head: true })
  totalGuardados.value = cGuardados ?? 0

  const lastAlertas = localStorage.getItem('fyl_last_alertas')
  if (lastAlertas) {
    const { data: cfgs } = await supabase
      .from('alert_configs')
      .select('tipos, fuentes, monto_rangos, palabras_clave, foco')
      .eq('user_id', user.id)
      .eq('activo', true)

    if (cfgs?.length) {
      // Agregar todos los filtros de todas las alertas activas
      const tipos    = [...new Set(cfgs.flatMap((c: any) => c.tipos     ?? []))]
      const fuentes  = [...new Set(cfgs.flatMap((c: any) => c.fuentes   ?? []))]
      const rangos   = [...new Set(cfgs.flatMap((c: any) => c.monto_rangos ?? []))]
      const keywords = [...new Set(cfgs.flatMap((c: any) => c.palabras_clave ?? []))]

      const hoyAlertas = new Date().toISOString().split('T')[0]
      let q = supabase.from('convocatorias').select('id', { count: 'exact', head: true })
        .eq('estado', 'abierto').gt('fecha_scrapeado', lastAlertas)
        .or(`fecha_cierre_postulacion.gte.${hoyAlertas},fecha_cierre_postulacion.is.null`)
      if (tipos.length)   q = q.in('tipo', tipos)
      if (fuentes.length) q = q.in('fuente', fuentes)
      if (rangos.length)  q = q.in('monto_rango', rangos)
      if (keywords.length) {
        const terms = keywords.flatMap((k: string) => [`titulo.ilike.%${k}%`, `descripcion_breve.ilike.%${k}%`]).join(',')
        q = q.or(terms)
      }
      const { count } = await q
      alertasNuevas.value = count ?? 0
    }
  }
})

async function logout() {
  menuOpen.value = false
  resetPlan()
  await supabase.auth.signOut()
  router.push('/login')
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
* { box-sizing: border-box; }

.shell {
  display: flex;
  min-height: 100vh;
  font-family: 'Inter', sans-serif;
  background: #f1f5f9;
  padding-top: 52px;
}

/* ── Navbar ─────────────────────────────────────────────────────── */
.navbar {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: 52px;
  background: white;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1rem 0 0;
  z-index: 100;
}

.navbar-left {
  display: flex;
  align-items: center;
  gap: 0;
  width: 240px;
  padding-left: 1rem;
  flex-shrink: 0;
}

.brand {
  display: flex;
  align-items: center;
  text-decoration: none;
  flex-shrink: 0;
}
.brand-logo {
  height: 32px;
  width: auto;
  object-fit: contain;
}

.navbar-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  position: relative;
}

.plan-badge {
  font-size: 0.65rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
}
.badge-free    { background: #f1f5f9; color: #64748b; }
.badge-starter { background: #eff6ff; color: #2563eb; }
.badge-advanced { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; }
.badge-agency   { background: linear-gradient(135deg, #0ea5e9, #6366f1); color: white; }

.user-menu {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  padding: 0.375rem 0.625rem;
  border-radius: 8px;
  transition: background 0.15s;
  user-select: none;
}
.user-menu:hover { background: #f8fafc; }

.avatar {
  width: 28px; height: 28px;
  border-radius: 7px;
  background: linear-gradient(135deg, #0ea5e9, #6366f1);
  display: flex; align-items: center; justify-content: center;
  font-size: 0.72rem; font-weight: 700; color: white;
  flex-shrink: 0;
}
.avatar-lg { width: 34px; height: 34px; font-size: 0.85rem; border-radius: 9px; }

.user-email-nav {
  font-size: 0.8rem;
  color: #475569;
  font-weight: 500;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chevron-nav { color: #94a3b8; transition: transform 0.2s; }
.chevron-nav.open { transform: rotate(180deg); }

/* Dropdown */
.dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 240px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.1);
  z-index: 200;
  overflow: hidden;
}
.dropdown-header {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.875rem 1rem;
}
.dropdown-email { font-size: 0.8125rem; font-weight: 600; color: #0f172a; }
.dropdown-plan  { font-size: 0.72rem; color: #94a3b8; margin-top: 0.1rem; }
.dropdown-divider { height: 1px; background: #f1f5f9; }
.dropdown-item {
  display: flex; align-items: center; gap: 0.6rem;
  padding: 0.625rem 1rem;
  font-size: 0.875rem; font-weight: 500; color: #475569;
  text-decoration: none; background: none; border: none;
  width: 100%; cursor: pointer; font-family: 'Inter', sans-serif;
  transition: background 0.1s;
}
.dropdown-item:hover { background: #f8fafc; color: #0f172a; }
.dropdown-upgrade { color: #0ea5e9; }
.dropdown-upgrade:hover { background: #f0f9ff; color: #0284c7; }
.dropdown-logout { color: #ef4444; }
.dropdown-logout:hover { background: #fef2f2; color: #dc2626; }

.dropdown-enter-active { animation: drop-in 0.15s ease; }
.dropdown-leave-active { animation: drop-in 0.1s ease reverse; }
@keyframes drop-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }

/* ── Sidebar ─────────────────────────────────────────────────────── */
.sidebar {
  width: 240px;
  height: calc(100vh - 52px);
  background: #0f172a;
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 52px;
  left: 0;
  flex-shrink: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  scrollbar-color: #1e293b transparent;
}
.sidebar::-webkit-scrollbar { width: 4px; }
.sidebar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 4px; }

.nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 1rem;
  flex: 1;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  border-radius: 8px;
  color: #64748b;
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.15s;
  flex-shrink: 0;
}
.nav-item:hover  { background: #1e293b; color: #cbd5e1; }
.nav-item.active { background: #1e293b; color: #38bdf8; }
.nav-item.active svg { color: #38bdf8; }

.nav-pro {
  margin-left: auto;
  font-size: 0.55rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;
  background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white;
  padding: 0.1rem 0.35rem; border-radius: 4px;
}
.nav-match { color: #94a3b8; }
.nav-match.active { color: #a78bfa; }
.nav-match.active svg { color: #a78bfa; }
.nav-match:hover { color: #c4b5fd; }

.nav-badge {
  margin-left: auto;
  background: #0ea5e9; color: white;
  font-size: 0.6rem; font-weight: 700;
  padding: 0.1rem 0.4rem; border-radius: 999px; line-height: 1.4;
}
.nav-count {
  margin-left: auto;
  background: #1e293b; color: #64748b;
  font-size: 0.7rem; font-weight: 600;
  padding: 0.1rem 0.4rem; border-radius: 999px; line-height: 1.4;
}
.nav-divider { height: 1px; background: #1e293b; margin: 0.5rem 0.75rem; }

.nav-admin-toggle {
  display: flex; align-items: center; gap: 0.5rem;
  width: 100%; padding: 0.5rem 0.75rem;
  background: none; border: none; border-radius: 8px;
  color: #475569; font-size: 0.6875rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.08em;
  cursor: pointer; transition: all 0.15s; font-family: 'Inter', sans-serif;
}
.nav-admin-toggle:hover { background: #1e293b; color: #94a3b8; }
.chevron { margin-left: auto; transition: transform 0.2s; }
.chevron.open { transform: rotate(180deg); }
.nav-sub { padding-left: 1.75rem; font-size: 0.85rem; }

/* ── Main ────────────────────────────────────────────────────────── */
.main {
  flex: 1;
  margin-left: 240px;
  overflow-y: auto;
  min-height: calc(100vh - 52px);
}

/* ── Mobile ──────────────────────────────────────────────────────── */
.hamburger {
  display: none;
  background: none; border: none;
  cursor: pointer; color: #475569;
  padding: 0.375rem; border-radius: 7px;
  transition: background 0.15s;
}
.hamburger:hover { background: #f1f5f9; }

.sidebar-close {
  display: none;
  position: absolute; top: 0.75rem; right: 0.75rem;
  background: none; border: none; color: #475569;
  cursor: pointer; padding: 4px;
}

.overlay {
  display: none;
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  z-index: 99;
}

@media (max-width: 768px) {
  .hamburger { display: flex; }
  .sidebar-close { display: flex; }
  .overlay { display: block; }
  .navbar-left { width: auto; }
  .user-email-nav { display: none; }
  .sidebar {
    left: -240px;
    top: 0;
    height: 100vh;
    z-index: 150;
    transition: left 0.25s ease;
    padding-top: 3rem;
  }
  .sidebar.open { left: 0; }
  .main { margin-left: 0; }
}
</style>
