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
              <th>Estado</th>
              <th>Rol</th>
              <th>Registro</th>
              <th>Último ingreso</th>
              <th>Ingresos (30d)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in usuariosFiltrados" :key="u.id" :class="{ 'row-archived': u.archived_at }">
              <td class="email-cell">
                <NuxtLink :to="`/dashboard/admin/usuarios/${u.id}`" class="email-link">{{ u.email }}</NuxtLink>
                <span v-if="u.archived_at" class="tag-archived">archivada</span>
                <span v-else-if="u.is_internal" class="tag-internal">interna</span>
              </td>
              <td>
                <span v-if="u.role === 'admin'" class="plan-na">—</span>
                <select
                  v-else
                  v-model="u.plan"
                  :disabled="changingPlan === u.id || !!u.archived_at"
                  class="plan-select"
                  :class="u.plan"
                  @change="askChangePlan(u, ($event.target as HTMLSelectElement).value)"
                >
                  <option value="free">Free</option>
                  <option value="starter">Starter</option>
                  <option value="advanced">Advanced</option>
                  <option value="agency">Agency</option>
                </select>
              </td>
              <td><span :class="['badge', u.plan_status === 'active' ? 'badge-active' : 'badge-inactive']">{{ u.plan_status }}</span></td>
              <td><span :class="['badge', u.role === 'admin' ? 'badge-admin' : 'badge-user']">{{ u.role }}</span></td>
              <td class="date-cell">{{ formatDate(u.created_at) }}</td>
              <td class="date-cell">{{ u.last_sign_in_at ? formatDate(u.last_sign_in_at) : '—' }}</td>
              <td>
                <span :class="['logins-pill', u.logins_30d > 0 ? 'logins-on' : 'logins-off']">{{ u.logins_30d }}</span>
              </td>
              <td class="action-cell">
                <button
                  v-if="u.id !== currentUserId"
                  :class="['arch-btn', u.archived_at ? 'arch-btn-restore' : 'arch-btn-archive']"
                  :disabled="archivingId === u.id"
                  @click="askArchive(u)"
                >
                  {{ archivingId === u.id ? '…' : u.archived_at ? 'Restaurar' : 'Archivar' }}
                </button>
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

// Plan original por id, para revertir el select si se cancela la confirmación.
const originalPlans = new Map<string, string>()

const pendingPlan = ref<{ user: UserRow; email: string; oldPlan: string; newPlan: string } | null>(null)
const pendingArchive = ref<UserRow | null>(null)

const visibles = computed(() =>
  showArchived.value ? users.value : users.value.filter(u => !u.archived_at)
)

const usuariosFiltrados = computed(() => {
  if (!busqueda.value.trim()) return visibles.value
  const q = busqueda.value.toLowerCase()
  return visibles.value.filter(u => u.email.toLowerCase().includes(q))
})

const archivadasCount = computed(() => users.value.filter(u => u.archived_at).length)

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

// ── Cambio de plan con confirmación ──────────────────────────────────────────
function askChangePlan(u: UserRow, newPlan: string) {
  const oldPlan = originalPlans.get(u.id) ?? u.plan
  if (oldPlan === newPlan) return
  pendingPlan.value = { user: u, email: u.email, oldPlan, newPlan }
}

function cancelChangePlan() {
  if (pendingPlan.value) {
    // revertir el select al valor original
    pendingPlan.value.user.plan = pendingPlan.value.oldPlan
  }
  pendingPlan.value = null
}

async function confirmChangePlan() {
  if (!pendingPlan.value) return
  const { user: u, newPlan, oldPlan } = pendingPlan.value
  changingPlan.value = u.id
  const { error: err } = await supabase.rpc('admin_set_user_plan', { target_id: u.id, new_plan: newPlan })
  if (err) {
    u.plan = oldPlan
    show('No se pudo cambiar el plan', 'error')
  } else {
    u.plan = newPlan
    originalPlans.set(u.id, newPlan)
    show('Plan actualizado', 'ok')
  }
  changingPlan.value = ''
  pendingPlan.value = null
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
    for (const u of users.value) originalPlans.set(u.id, u.plan)
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

.table-wrap {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
}

table { width: 100%; border-collapse: collapse; }

thead tr { background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
th {
  text-align: left;
  padding: 0.75rem 1rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #475569;
  white-space: nowrap;
}

tbody tr { border-bottom: 1px solid #f1f5f9; }
tbody tr:last-child { border-bottom: none; }
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
.tag-archived, .tag-internal {
  font-size: 0.65rem; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.03em; padding: 0.1rem 0.4rem; border-radius: 5px;
}
.tag-archived { background: #f1f5f9; color: #94a3b8; }
.tag-internal { background: #f0fdf4; color: #15803d; }

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
.badge-active  { background: #dcfce7; color: #15803d; }
.badge-inactive{ background: #fef2f2; color: #b91c1c; }
.badge-admin   { background: #fef3c7; color: #b45309; }
.badge-user    { background: #f1f5f9; color: #475569; }

.plan-select {
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  border: 1.5px solid #e2e8f0;
  cursor: pointer;
  font-family: 'Inter', sans-serif;
  outline: none;
  transition: border-color 0.15s;
}
.plan-select:disabled { opacity: 0.5; cursor: not-allowed; }
.plan-select.free     { background: #f1f5f9; color: #475569; }
.plan-select.starter  { background: #eff6ff; color: #2563eb; border-color: #bfdbfe; }
.plan-select.advanced { background: #ede9fe; color: #6d28d9; border-color: #c4b5fd; }
.plan-select.agency   { background: #e0f2fe; color: #0369a1; border-color: #7dd3fc; }

.action-cell { text-align: right; }

.arch-btn {
  padding: 0.3rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  border: 1.5px solid;
  transition: all 0.15s;
  font-family: 'Inter', sans-serif;
}
.arch-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.arch-btn-archive {
  background: #fff7ed; border-color: #fdba74; color: #c2410c;
}
.arch-btn-archive:hover:not(:disabled) { background: #ffedd5; }
.arch-btn-restore {
  background: #eff6ff; border-color: #93c5fd; color: #1d4ed8;
}
.arch-btn-restore:hover:not(:disabled) { background: #dbeafe; }

.loading, .error {
  padding: 3rem;
  text-align: center;
  color: #64748b;
  font-size: 0.9rem;
}
.error { color: #ef4444; }
</style>
