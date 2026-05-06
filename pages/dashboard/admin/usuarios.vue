<template>
  <NuxtLayout name="dashboard">
    <div class="content">
      <div class="header">
        <div>
          <h1>Usuarios</h1>
          <p class="subtitle">Gestión de usuarios registrados</p>
        </div>
      </div>

      <!-- Stats -->
      <div class="stats-row" v-if="!loading">
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
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in users" :key="u.id">
              <td class="email-cell">{{ u.email }}</td>
              <td>
                <select
                  :value="u.plan"
                  :disabled="changingPlan === u.id"
                  class="plan-select"
                  :class="u.plan"
                  @change="changePlan(u, ($event.target as HTMLSelectElement).value)"
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
              <td class="action-cell">
                <button
                  v-if="u.id !== currentUserId"
                  :class="['role-btn', u.role === 'admin' ? 'role-btn-demote' : 'role-btn-promote']"
                  :disabled="togglingId === u.id"
                  @click="toggleRole(u)"
                >
                  {{ togglingId === u.id ? '…' : u.role === 'admin' ? 'Quitar admin' : 'Hacer admin' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
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
}

const { show } = useToast()

const users = ref<UserRow[]>([])
const loading = ref(true)
const loadError = ref(false)
const togglingId = ref('')
const changingPlan = ref('')
const currentUserId = ref('')

const total = computed(() => users.value.length)
const byPlan = computed(() => ({
  free:     users.value.filter(u => u.plan === 'free').length,
  starter:  users.value.filter(u => u.plan === 'starter').length,
  advanced: users.value.filter(u => u.plan === 'advanced').length,
  agency:   users.value.filter(u => u.plan === 'agency').length,
}))

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

async function changePlan(u: UserRow, newPlan: string) {
  changingPlan.value = u.id
  const { error: err } = await supabase.rpc('admin_set_user_plan', { target_id: u.id, new_plan: newPlan })
  if (err) {
    console.error('changePlan:', err)
    show('No se pudo cambiar el plan', 'error')
  } else {
    u.plan = newPlan
    show('Plan actualizado', 'ok')
  }
  changingPlan.value = ''
}

async function toggleRole(u: UserRow) {
  togglingId.value = u.id
  const newRole = u.role === 'admin' ? 'user' : 'admin'
  const { error: err } = await supabase.rpc('admin_set_user_role', { target_id: u.id, new_role: newRole })
  if (err) {
    console.error('toggleRole:', err)
    show('No se pudo cambiar el rol', 'error')
  } else {
    u.role = newRole
    show('Rol actualizado', 'ok')
  }
  togglingId.value = ''
}

onMounted(async () => {
  const { data: { user } } = await supabase.auth.getUser()
  currentUserId.value = user?.id ?? ''

  const { data, error: err } = await supabase.rpc('admin_get_users')
  if (err) {
    console.error('admin_get_users:', err)
    loadError.value = true
  } else {
    users.value = data ?? []
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

td {
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  color: #334155;
}

.email-cell { color: #0f172a; font-weight: 500; }
.date-cell { color: #64748b; font-size: 0.8125rem; }

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

.role-btn {
  padding: 0.3rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  border: 1.5px solid;
  transition: all 0.15s;
  font-family: 'Inter', sans-serif;
}

.role-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.role-btn-promote {
  background: #fefce8;
  border-color: #fbbf24;
  color: #b45309;
}
.role-btn-promote:hover:not(:disabled) {
  background: #fef3c7;
}

.role-btn-demote {
  background: #f1f5f9;
  border-color: #cbd5e1;
  color: #475569;
}
.role-btn-demote:hover:not(:disabled) {
  background: #e2e8f0;
}

.loading, .error {
  padding: 3rem;
  text-align: center;
  color: #64748b;
  font-size: 0.9rem;
}
.error { color: #ef4444; }
</style>
