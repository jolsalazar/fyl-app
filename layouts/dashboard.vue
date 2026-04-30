<template>
  <div class="shell">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-dot"></span>
        Fondos y Licitaciones
      </div>

      <nav class="nav">
        <NuxtLink to="/dashboard" class="nav-item" exact-active-class="active">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          Fondos
          <span v-if="nuevas > 0" class="nav-badge">{{ nuevas > 99 ? '99+' : nuevas }}</span>
        </NuxtLink>
        <NuxtLink to="/dashboard/licitaciones" class="nav-item" active-class="active">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          Licitaciones
        </NuxtLink>
        <NuxtLink to="/dashboard/guardados" class="nav-item" active-class="active">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          Guardados
          <span v-if="totalGuardados > 0" class="nav-count">{{ totalGuardados }}</span>
        </NuxtLink>
        <NuxtLink to="/dashboard/postulaciones" class="nav-item" active-class="active">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          Postulaciones
        </NuxtLink>
        <NuxtLink to="/dashboard/calendario" class="nav-item" active-class="active">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Calendario
        </NuxtLink>
        <NuxtLink to="/dashboard/alertas" class="nav-item" active-class="active">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6.002 6.002 0 0 0-4-5.659V5a2 2 0 1 0-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"/></svg>
          Mis alertas
          <span v-if="alertasNuevas > 0" class="nav-badge">{{ alertasNuevas > 99 ? '99+' : alertasNuevas }}</span>
        </NuxtLink>
        <NuxtLink to="/dashboard/match" class="nav-item nav-match" active-class="active">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          Mi Match
          <span class="nav-pro">Pro</span>
        </NuxtLink>
        <NuxtLink to="/dashboard/mi-perfil" class="nav-item" active-class="active">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Mi Perfil
        </NuxtLink>
        <NuxtLink to="/dashboard/configuracion" class="nav-item" active-class="active">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          Configuración
        </NuxtLink>

        <template v-if="isAdmin">
          <div class="nav-divider"></div>
          <button class="nav-admin-toggle" @click="adminExpanded = !adminExpanded">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Admin
            <svg class="chevron" :class="{ open: adminExpanded }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <template v-if="adminExpanded">
            <NuxtLink to="/dashboard/admin/usuarios" class="nav-item nav-sub" active-class="active">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Usuarios
            </NuxtLink>
            <NuxtLink to="/dashboard/admin/fuentes" class="nav-item nav-sub" active-class="active">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
              Fuentes
            </NuxtLink>
            <NuxtLink to="/dashboard/admin/metricas" class="nav-item nav-sub" active-class="active">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              Métricas
            </NuxtLink>
          </template>
        </template>
      </nav>

      <div class="sidebar-footer">
        <div class="avatar">{{ inicial }}</div>
        <span class="user-email">{{ email }}</span>
        <button class="logout-btn" @click="logout" title="Cerrar sesión">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </button>
      </div>
    </aside>

    <!-- Main -->
    <main class="main">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient()
const router = useRouter()

const email = ref('')
const isAdmin = ref(false)
const adminExpanded = ref(false)
const nuevas = ref(0)
const totalGuardados = ref(0)
const alertasNuevas = ref(0)
const inicial = computed(() => email.value?.[0]?.toUpperCase() ?? '?')

onMounted(async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  email.value = user.email ?? ''

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  isAdmin.value = profile?.role === 'admin'

  // Badge: nuevas convocatorias desde última visita
  const lastVisit = localStorage.getItem('fyl_last_visit')
  if (lastVisit) {
    const { count } = await supabase
      .from('convocatorias')
      .select('id', { count: 'exact', head: true })
      .gt('fecha_scrapeado', lastVisit)
      .eq('estado', 'abierto')
    nuevas.value = count ?? 0
  }

  // Contador de guardados
  const { count: cGuardados } = await supabase
    .from('guardados')
    .select('id', { count: 'exact', head: true })
  totalGuardados.value = cGuardados ?? 0

  // Badge de alertas nuevas desde última visita
  const lastAlertas = localStorage.getItem('fyl_last_alertas')
  if (lastAlertas) {
    const { data: cfg } = await supabase
      .from('alert_configs')
      .select('palabras_clave, tipos, fuentes, monto_rangos')
      .eq('user_id', user.id)
      .maybeSingle()

    if (cfg) {
      const tieneConfig = (cfg.palabras_clave?.length || cfg.tipos?.length || cfg.fuentes?.length || cfg.monto_rangos?.length)
      if (tieneConfig) {
        let q = supabase.from('convocatorias').select('id', { count: 'exact', head: true })
          .eq('estado', 'abierto').gt('fecha_scrapeado', lastAlertas)
        if (cfg.tipos?.length)        q = q.in('tipo', cfg.tipos)
        if (cfg.fuentes?.length)      q = q.in('fuente', cfg.fuentes)
        if (cfg.monto_rangos?.length) q = q.in('monto_rango', cfg.monto_rangos)
        if (cfg.palabras_clave?.length) {
          const terms = cfg.palabras_clave.flatMap((k: string) => [`titulo.ilike.%${k}%`, `descripcion_breve.ilike.%${k}%`]).join(',')
          q = q.or(terms)
        }
        const { count } = await q
        alertasNuevas.value = count ?? 0
      }
    }
  }
})

async function logout() {
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
}

/* Sidebar */
.sidebar {
  width: 240px;
  min-height: 100vh;
  background: #0f172a;
  display: flex;
  flex-direction: column;
  padding: 1.5rem 1rem;
  position: sticky;
  top: 0;
  height: 100vh;
  flex-shrink: 0;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 800;
  color: white;
  padding: 0.5rem 0.75rem;
  margin-bottom: 2rem;
  letter-spacing: -0.02em;
}

.brand-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #0ea5e9;
  box-shadow: 0 0 8px #0ea5e9;
  flex-shrink: 0;
}

.nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
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
}

.nav-item:hover {
  background: #1e293b;
  color: #cbd5e1;
}

.nav-item.active {
  background: #1e293b;
  color: #38bdf8;
}

.nav-item.active svg {
  color: #38bdf8;
}

.nav-pro {
  margin-left: auto;
  font-size: 0.55rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
}

.nav-match { color: #94a3b8; }
.nav-match.active { color: #a78bfa; }
.nav-match.active svg { color: #a78bfa; }
.nav-match:hover { color: #c4b5fd; }

.nav-badge {
  margin-left: auto;
  background: #0ea5e9;
  color: white;
  font-size: 0.6rem;
  font-weight: 700;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  line-height: 1.4;
}

.nav-count {
  margin-left: auto;
  background: #1e293b;
  color: #64748b;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  line-height: 1.4;
}

.nav-divider {
  height: 1px;
  background: #1e293b;
  margin: 0.5rem 0.75rem;
}

/* Admin toggle */
.nav-admin-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: none;
  border: none;
  border-radius: 8px;
  color: #475569;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: all 0.15s;
  font-family: 'Inter', sans-serif;
}
.nav-admin-toggle:hover { background: #1e293b; color: #94a3b8; }

.chevron { margin-left: auto; transition: transform 0.2s; }
.chevron.open { transform: rotate(180deg); }

.nav-sub {
  padding-left: 1.75rem;
  font-size: 0.85rem;
}

/* Footer */
.sidebar-footer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  margin-top: 0.5rem;
  border-top: 1px solid #1e293b;
}

.avatar {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: linear-gradient(135deg, #0ea5e9, #6366f1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 700;
  color: white;
  flex-shrink: 0;
}

.user-email {
  font-size: 0.72rem;
  color: #475569;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.logout-btn {
  background: none;
  border: none;
  color: #334155;
  cursor: pointer;
  padding: 3px;
  border-radius: 5px;
  display: flex;
  align-items: center;
  transition: color 0.15s;
  flex-shrink: 0;
}
.logout-btn:hover { color: #ef4444; }

/* Main content */
.main {
  flex: 1;
  overflow-y: auto;
}
</style>
