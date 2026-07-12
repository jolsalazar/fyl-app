<template>
  <NuxtLayout name="dashboard">
    <div class="content">
      <div class="header">
        <div>
          <h1>Usuarios</h1>
          <p class="subtitle">Gestión de usuarios registrados</p>
        </div>
      </div>

      <!-- Stats (excluye administradores) -->
      <div class="stats-row" v-if="!loading && !loadError">
        <div class="stat-card">
          <span class="stat-num">{{ total }}</span>
          <span class="stat-label">Total</span>
        </div>
        <div class="stat-card">
          <span class="stat-num">{{ byPlan.free }}</span>
          <span class="stat-label">Free</span>
        </div>
        <div class="stat-card accent-starter">
          <span class="stat-num">{{ byPlan.starter }}</span>
          <span class="stat-label">Starter</span>
        </div>
        <div class="stat-card accent-advanced">
          <span class="stat-num">{{ byPlan.advanced }}</span>
          <span class="stat-label">Advanced</span>
        </div>
        <div class="stat-card accent-agency">
          <span class="stat-num">{{ byPlan.agency }}</span>
          <span class="stat-label">Agency</span>
        </div>
      </div>

      <!-- Controles -->
      <div class="controls" v-if="!loading && !loadError">
        <div class="search-bar">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input v-model="busqueda" type="text" placeholder="Buscar por email…" class="search-input" />
          <span v-if="busqueda" class="search-count">{{ usuariosFiltrados.length }} resultado{{ usuariosFiltrados.length !== 1 ? 's' : '' }}</span>
        </div>
        <label class="toggle-archived">
          <input type="checkbox" v-model="soloLeads" />
          Solo interesados sin pagar
          <span v-if="leadsCount" class="leads-count">{{ leadsCount }}</span>
        </label>
        <label class="toggle-archived">
          <input type="checkbox" v-model="showArchived" />
          Mostrar archivadas
          <span v-if="archivadasCount" class="archived-count">{{ archivadasCount }}</span>
        </label>
      </div>

      <!-- Table -->
      <div class="table-wrap">
        <div v-if="loading" class="loading">Cargando usuarios…</div>
        <div v-else-if="loadError" class="error">No se pudieron cargar los usuarios. Intenta recargar la página.</div>
        <table v-else>
          <thead>
            <tr>
              <th>Email</th>
              <th>Plan</th>
              <th>Registro</th>
              <th>Último ingreso</th>
              <th>Ingresos (30d / total)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in usuariosFiltrados" :key="u.id" :class="{ 'row-archived': u.archived_at }">
              <td class="email-cell">
                <NuxtLink :to="`/dashboard/admin/usuarios/${u.id}`" class="email-link">{{ u.email }}</NuxtLink>
                <span v-if="u.role === 'admin'" class="tag-admin">admin</span>
                <span v-if="u.archived_at" class="tag-archived">archivada</span>
                <span v-else-if="u.is_internal" class="tag-internal">interna</span>
                <span v-if="u.plan_status === 'inactive'" class="tag-inactive">desactivada</span>
              </td>
              <td>
                <span v-if="u.role === 'admin'" class="plan-na">—</span>
                <span v-else :class="['badge', `badge-${u.plan}`]">{{ u.plan }}</span>
              </td>
              <td class="date-cell">{{ formatDate(u.created_at) }}</td>
              <td class="date-cell">{{ u.last_sign_in_at ? formatDate(u.last_sign_in_at) : '—' }}</td>
              <td>
                <span :class="['logins-pill', u.logins_30d > 0 ? 'logins-on' : 'logins-off']">{{ u.logins_30d }} / {{ u.logins_total }}</span>
              </td>
              <td class="action-cell">
                <div
                  v-if="tieneAcciones(u)"
                  class="kebab-wrap"
                  v-click-outside="() => { if (openMenuId === u.id) openMenuId = '' }"
                >
                  <button
                    class="kebab-btn"
                    :class="{ active: openMenuId === u.id }"
                    aria-label="Acciones"
                    @click="toggleMenu(u.id)"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>
                  </button>
                  <Transition name="dropdown">
                    <div v-if="openMenuId === u.id" class="row-menu">
                      <template v-if="puedeCambiarPlan(u)">
                        <button
                          v-for="p in otrosPlanes(u)"
                          :key="p"
                          class="menu-item"
                          @click="pickPlan(u, p)"
                        >
                          Cambiar a {{ getNombrePlan(p) }}
                        </button>
                        <div v-if="u.id !== currentUserId" class="menu-divider"></div>
                      </template>
                      <button
                        v-if="puedeDesactivar(u)"
                        :class="['menu-item', u.plan_status === 'inactive' ? 'menu-restore' : 'menu-deactivate']"
                        @click="pickActive(u)"
                      >
                        {{ u.plan_status === 'inactive' ? 'Reactivar' : 'Desactivar' }}
                      </button>
                      <button
                        v-if="u.id !== currentUserId"
                        :class="['menu-item', u.archived_at ? 'menu-restore' : 'menu-archive']"
                        @click="pickArchive(u)"
                      >
                        {{ u.archived_at ? 'Restaurar' : 'Archivar' }}
                      </button>
                    </div>
                  </Transition>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Confirmación cambio de plan -->
    <ConfirmDialog
      :open="!!pendingPlan"
      tone="primary"
      title="Cambiar plan"
      :message="pendingPlan ? `¿Cambiar el plan de ${pendingPlan.email} de «${pendingPlan.oldPlan}» a «${pendingPlan.newPlan}»? Esto modifica su acceso y queda registrado en finanzas.` : ''"
      confirm-text="Sí, cambiar plan"
      :busy="!!changingPlan"
      @confirm="confirmChangePlan"
      @cancel="cancelChangePlan"
    />

    <!-- Confirmación desactivar / reactivar -->
    <ConfirmDialog
      :open="!!pendingActive"
      :tone="pendingActive?.plan_status === 'inactive' ? 'primary' : 'warning'"
      :title="pendingActive?.plan_status === 'inactive' ? 'Reactivar cuenta' : 'Desactivar cuenta'"
      :message="pendingActive
        ? (pendingActive.plan_status === 'inactive'
            ? `${pendingActive.email} podrá volver a iniciar sesión normalmente.`
            : `${pendingActive.email} no podrá iniciar sesión hasta que la reactives (su sesión actual expira en máximo una hora). No se elimina nada.`)
        : ''"
      :confirm-text="pendingActive?.plan_status === 'inactive' ? 'Reactivar' : 'Desactivar'"
      :busy="!!togglingActiveId"
      @confirm="confirmActive"
      @cancel="pendingActive = null"
    />

    <!-- Confirmación archivar / restaurar -->
    <ConfirmDialog
      :open="!!pendingArchive"
      :tone="pendingArchive?.archived_at ? 'primary' : 'warning'"
      :title="pendingArchive?.archived_at ? 'Restaurar cuenta' : 'Archivar cuenta'"
      :message="pendingArchive
        ? (pendingArchive.archived_at
            ? `La cuenta ${pendingArchive.email} volverá a aparecer en el listado.`
            : `${pendingArchive.email} dejará de aparecer en el listado. No se elimina nada: el correo y todos sus datos se conservan y puedes restaurarla cuando quieras.`)
        : ''"
      :confirm-text="pendingArchive?.archived_at ? 'Restaurar' : 'Archivar'"
      :busy="!!archivingId"
      @confirm="confirmArchive"
      @cancel="pendingArchive = null"
    />
  </NuxtLayout>
</template>

<script setup lang="ts">
import { getNombrePlan } from '~~/utils/planes'

definePageMeta({ middleware: ['auth', 'admin'], layout: false })

const supabase = useSupabaseClient()

interface UserRow {
  id: string
  email: string
  plan: string
  role: string
  plan_status: string
  created_at: string
  last_sign_in_at: string | null
  archived_at: string | null
  is_internal: boolean
  logins_30d: number
  logins_total: number
  intended_plan: string | null
}

const { show } = useToast()

const users = ref<UserRow[]>([])
const loading = ref(true)
const loadError = ref(false)
const archivingId = ref('')
const changingPlan = ref('')
const currentUserId = ref('')
const busqueda = ref('')
const showArchived = ref(false)
const soloLeads = ref(false)

const pendingPlan = ref<{ user: UserRow; email: string; oldPlan: string; newPlan: string } | null>(null)
const pendingArchive = ref<UserRow | null>(null)
const pendingActive = ref<UserRow | null>(null)
const togglingActiveId = ref('')

const visibles = computed(() =>
  showArchived.value ? users.value : users.value.filter(u => !u.archived_at)
)

const usuariosFiltrados = computed(() => {
  let lista = visibles.value
  if (soloLeads.value) lista = lista.filter(esLead)
  if (busqueda.value.trim()) {
    const q = busqueda.value.toLowerCase()
    lista = lista.filter(u => u.email.toLowerCase().includes(q))
  }
  return lista
})

const archivadasCount = computed(() => users.value.filter(u => u.archived_at).length)

// Lead = mostró intención de plan de pago pero sigue en otro plan (misma regla
// que el detalle de usuario).
function esLead(u: UserRow) {
  return !!u.intended_plan && u.intended_plan !== u.plan && u.role !== 'admin'
}
const leadsCount = computed(() => visibles.value.filter(esLead).length)

// Contadores: excluyen admins y archivadas (no son clientes contabilizables).
const contables = computed(() =>
  users.value.filter(u => u.role !== 'admin' && !u.archived_at)
)
const total = computed(() => contables.value.length)
const byPlan = computed(() => ({
  free:     contables.value.filter(u => u.plan === 'free').length,
  starter:  contables.value.filter(u => u.plan === 'starter').length,
  advanced: contables.value.filter(u => u.plan === 'advanced').length,
  agency:   contables.value.filter(u => u.plan === 'agency').length,
}))

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Menú de acciones por fila (kebab) ─────────────────────────────────────────
const PLANES = ['free', 'starter', 'advanced', 'agency']

const openMenuId = ref('')
function toggleMenu(id: string) {
  openMenuId.value = openMenuId.value === id ? '' : id
}
// Misma regla que tenía el select: sin cambio de plan para admins ni archivadas.
function puedeCambiarPlan(u: UserRow) {
  return u.role !== 'admin' && !u.archived_at
}
function otrosPlanes(u: UserRow) {
  return PLANES.filter(p => p !== u.plan)
}
// Desactivar bloquea el login de verdad: solo cuentas no-admin y nunca la propia.
function puedeDesactivar(u: UserRow) {
  return u.role !== 'admin' && u.id !== currentUserId.value
}
function tieneAcciones(u: UserRow) {
  return puedeCambiarPlan(u) || puedeDesactivar(u) || u.id !== currentUserId.value
}
function pickPlan(u: UserRow, newPlan: string) {
  openMenuId.value = ''
  askChangePlan(u, newPlan)
}
function pickArchive(u: UserRow) {
  openMenuId.value = ''
  askArchive(u)
}
function pickActive(u: UserRow) {
  openMenuId.value = ''
  pendingActive.value = u
}

// Directive para cerrar el menú al clickear afuera (mismo patrón del layout).
const vClickOutside = {
  mounted(el: any, binding: any) {
    el._clickOutside = (e: MouseEvent) => {
      if (!el.contains(e.target as Node)) binding.value(e)
    }
    document.addEventListener('click', el._clickOutside)
  },
  unmounted(el: any) {
    document.removeEventListener('click', el._clickOutside)
  },
}

// ── Cambio de plan con confirmación ──────────────────────────────────────────
function askChangePlan(u: UserRow, newPlan: string) {
  if (u.plan === newPlan) return
  pendingPlan.value = { user: u, email: u.email, oldPlan: u.plan, newPlan }
}

function cancelChangePlan() {
  pendingPlan.value = null
}

async function confirmChangePlan() {
  if (!pendingPlan.value) return
  const { user: u, newPlan } = pendingPlan.value
  changingPlan.value = u.id
  const { error: err } = await supabase.rpc('admin_set_user_plan', { target_id: u.id, new_plan: newPlan })
  if (err) {
    show('No se pudo cambiar el plan', 'error')
  } else {
    u.plan = newPlan
    show('Plan actualizado', 'ok')
  }
  changingPlan.value = ''
  pendingPlan.value = null
}

// ── Desactivar / reactivar con confirmación ──────────────────────────────────
async function confirmActive() {
  if (!pendingActive.value) return
  const u = pendingActive.value
  const activar = u.plan_status === 'inactive'
  togglingActiveId.value = u.id
  const { error: err } = await supabase.rpc('admin_set_user_active', { target_id: u.id, active: activar })
  if (err) {
    show('No se pudo actualizar la cuenta', 'error')
  } else {
    u.plan_status = activar ? 'active' : 'inactive'
    show(activar ? 'Cuenta reactivada' : 'Cuenta desactivada', 'ok')
  }
  togglingActiveId.value = ''
  pendingActive.value = null
}

// ── Archivar / restaurar con confirmación ────────────────────────────────────
function askArchive(u: UserRow) {
  pendingArchive.value = u
}

async function confirmArchive() {
  if (!pendingArchive.value) return
  const u = pendingArchive.value
  const archivar = !u.archived_at
  archivingId.value = u.id
  const { error: err } = await supabase.rpc('admin_set_user_archived', { target_id: u.id, archived: archivar })
  if (err) {
    show('No se pudo actualizar la cuenta', 'error')
  } else {
    u.archived_at = archivar ? new Date().toISOString() : null
    show(archivar ? 'Cuenta archivada' : 'Cuenta restaurada', 'ok')
  }
  archivingId.value = ''
  pendingArchive.value = null
}

onMounted(async () => {
  const { data: { user } } = await supabase.auth.getUser()
  currentUserId.value = user?.id ?? ''

  const { data, error: err } = await supabase.rpc('admin_get_users')
  if (err) {
    loadError.value = true
  } else {
    users.value = (data ?? []) as UserRow[]
  }
  loading.value = false
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.content { flex: 1; padding: 2rem 2.5rem; font-family: 'Inter', sans-serif; }

.header { margin-bottom: 1.75rem; }
h1 { font-size: 1.625rem; font-weight: 700; color: #0f172a; letter-spacing: -0.025em; }
.subtitle { font-size: 0.875rem; color: #64748b; margin-top: 0.2rem; }

.stats-row {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.75rem;
  flex-wrap: wrap;
}

.stat-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 1.25rem 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 120px;
}

.stat-num {
  font-size: 2rem;
  font-weight: 800;
  color: #0f172a;
  line-height: 1;
}

.stat-label {
  font-size: 0.8125rem;
  color: #64748b;
  font-weight: 500;
}

.accent-starter .stat-num  { color: #f59e0b; }
.accent-advanced .stat-num { color: #6366f1; }
.accent-agency .stat-num   { color: #0ea5e9; }

.controls {
  display: flex; align-items: center; gap: 1rem;
  margin-bottom: 1rem; flex-wrap: wrap;
}
.search-bar {
  display: flex; align-items: center; gap: 0.625rem;
  background: white; border: 1px solid #e2e8f0; border-radius: 10px;
  padding: 0.5rem 0.875rem;
  color: #94a3b8; flex: 1; min-width: 220px;
}
.search-input {
  flex: 1; border: none; outline: none; font-size: 0.9rem;
  font-family: 'Inter', sans-serif; color: #0f172a; background: none;
}
.search-input::placeholder { color: #94a3b8; }
.search-count { font-size: 0.8rem; color: #94a3b8; white-space: nowrap; }

.toggle-archived {
  display: flex; align-items: center; gap: 0.45rem;
  font-size: 0.85rem; color: #475569; cursor: pointer; user-select: none;
  white-space: nowrap;
}
.toggle-archived input { cursor: pointer; }
.archived-count {
  background: #f1f5f9; color: #64748b; border-radius: 999px;
  padding: 0.05rem 0.5rem; font-size: 0.72rem; font-weight: 600;
}
.leads-count {
  background: #fef3c7; color: #b45309; border-radius: 999px;
  padding: 0.05rem 0.5rem; font-size: 0.72rem; font-weight: 600;
}

/* overflow visible para que el menú kebab no quede recortado; el redondeo
   de esquinas se hace en las celdas (border-collapse: separate). */
.table-wrap {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: visible;
}

table { width: 100%; border-collapse: separate; border-spacing: 0; }

thead tr { background: #f8fafc; }
th {
  text-align: left;
  padding: 0.75rem 1rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #475569;
  white-space: nowrap;
  border-bottom: 1px solid #e2e8f0;
}
thead th:first-child { border-top-left-radius: 12px; }
thead th:last-child  { border-top-right-radius: 12px; }

tbody td { border-bottom: 1px solid #f1f5f9; }
tbody tr:last-child td { border-bottom: none; }
tbody tr:last-child td:first-child { border-bottom-left-radius: 12px; }
tbody tr:last-child td:last-child  { border-bottom-right-radius: 12px; }
tbody tr:hover { background: #f8fafc; }
tbody tr.row-archived { opacity: 0.6; background: #fafafa; }

td {
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  color: #334155;
}

.email-cell { color: #0f172a; font-weight: 500; display: flex; align-items: center; gap: 0.5rem; }
.email-link { color: #2563eb; text-decoration: none; }
.email-link:hover { text-decoration: underline; }
.tag-archived, .tag-internal, .tag-admin, .tag-inactive {
  font-size: 0.65rem; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.03em; padding: 0.1rem 0.4rem; border-radius: 5px;
  white-space: nowrap;
}
.tag-archived { background: #f1f5f9; color: #94a3b8; }
.tag-internal { background: #f0fdf4; color: #15803d; }
.tag-admin    { background: #fef3c7; color: #b45309; }
.tag-inactive { background: #fef2f2; color: #b91c1c; }

.date-cell { color: #64748b; font-size: 0.8125rem; white-space: nowrap; }
.plan-na { color: #cbd5e1; font-weight: 600; }

.logins-pill {
  display: inline-block; min-width: 1.75rem; text-align: center;
  padding: 0.15rem 0.5rem; border-radius: 999px;
  font-size: 0.78rem; font-weight: 700;
}
.logins-on  { background: #dcfce7; color: #15803d; }
.logins-off { background: #f1f5f9; color: #94a3b8; }

.badge {
  display: inline-block;
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
}

.badge-free     { background: #f1f5f9; color: #475569; }
.badge-starter  { background: #eff6ff; color: #2563eb; }
.badge-advanced { background: #ede9fe; color: #6d28d9; }
.badge-agency   { background: #e0f2fe; color: #0369a1; }

.action-cell { text-align: right; }

/* Menú kebab por fila */
.kebab-wrap { position: relative; display: inline-block; }
.kebab-btn {
  width: 28px; height: 28px;
  display: inline-flex; align-items: center; justify-content: center;
  background: none; border: none; border-radius: 6px;
  color: #64748b; cursor: pointer;
  transition: background 0.1s, color 0.1s;
}
.kebab-btn:hover, .kebab-btn.active { background: #e2e8f0; color: #0f172a; }

.row-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 190px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.1);
  z-index: 50;
  overflow: hidden;
  padding: 0.25rem 0;
  text-align: left;
}
.menu-item {
  display: block; width: 100%;
  padding: 0.5rem 0.9rem;
  font-size: 0.8125rem; font-weight: 500; color: #475569;
  background: none; border: none; cursor: pointer;
  font-family: 'Inter', sans-serif; text-align: left;
  transition: background 0.1s;
}
.menu-item:hover { background: #f8fafc; color: #0f172a; }
.menu-archive { color: #c2410c; }
.menu-archive:hover { background: #fff7ed; color: #9a3412; }
.menu-deactivate { color: #b91c1c; }
.menu-deactivate:hover { background: #fef2f2; color: #991b1b; }
.menu-restore { color: #1d4ed8; }
.menu-restore:hover { background: #eff6ff; color: #1e40af; }
.menu-divider { height: 1px; background: #f1f5f9; margin: 0.25rem 0; }

.dropdown-enter-active { animation: drop-in 0.15s ease; }
.dropdown-leave-active { animation: drop-in 0.1s ease reverse; }
@keyframes drop-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }

.loading, .error {
  padding: 3rem;
  text-align: center;
  color: #64748b;
  font-size: 0.9rem;
}
.error { color: #ef4444; }
</style>
