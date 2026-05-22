<template>
  <NuxtLayout name="dashboard">
    <div class="content">
      <NuxtLink to="/dashboard/admin/usuarios" class="back-link">← Volver al listado</NuxtLink>

      <div v-if="loading" class="loading">Cargando usuario…</div>
      <div v-else-if="loadError" class="error">No se pudo cargar este usuario.</div>

      <template v-else-if="detail">
        <div class="header">
          <div>
            <h1>{{ detail.email }}</h1>
            <p class="subtitle">
              <span :class="['badge', detail.role === 'admin' ? 'badge-admin' : 'badge-user']">{{ detail.role }}</span>
              <span v-if="detail.role !== 'admin'" :class="['badge', `badge-${detail.plan}`]">{{ detail.plan }}</span>
              <span v-if="detail.archived_at" class="badge badge-archived">archivada</span>
              <span v-if="detail.is_internal" class="badge badge-internal">interna</span>
            </p>
          </div>
        </div>

        <!-- Datos / fechas -->
        <div class="grid">
          <div class="card">
            <h2>Datos</h2>
            <dl>
              <div><dt>Nombre</dt><dd>{{ detail.nombre || '—' }}</dd></div>
              <div><dt>Empresa</dt><dd>{{ detail.empresa || '—' }}</dd></div>
              <div><dt>RUT</dt><dd>{{ detail.rut || '—' }}</dd></div>
              <div><dt>Estado plan</dt><dd>{{ detail.plan_status }}</dd></div>
            </dl>
          </div>
          <div class="card">
            <h2>Fechas</h2>
            <dl>
              <div><dt>Registro</dt><dd>{{ fmt(detail.created_at) }}</dd></div>
              <div><dt>Último ingreso</dt><dd>{{ detail.last_sign_in_at ? fmt(detail.last_sign_in_at) : 'Nunca' }}</dd></div>
              <div v-if="detail.archived_at"><dt>Archivada</dt><dd>{{ fmt(detail.archived_at) }}</dd></div>
            </dl>
          </div>
        </div>

        <!-- Actividad -->
        <div class="card">
          <h2>Actividad</h2>
          <div class="metrics">
            <div class="metric">
              <span class="metric-num">{{ detail.counts.matches }}</span>
              <span class="metric-label">Matches</span>
              <span v-if="detail.counts.matches_no_vistos" class="metric-sub">{{ detail.counts.matches_no_vistos }} sin ver</span>
            </div>
            <div class="metric">
              <span class="metric-num">{{ detail.counts.proyectos }}</span>
              <span class="metric-label">Proyectos</span>
            </div>
            <div class="metric">
              <span class="metric-num">{{ detail.counts.guardados }}</span>
              <span class="metric-label">Guardados</span>
            </div>
            <div class="metric">
              <span class="metric-num">{{ detail.counts.postulaciones }}</span>
              <span class="metric-label">Postulaciones</span>
            </div>
          </div>
        </div>

        <!-- Config de alertas -->
        <div class="card" v-if="detail.alert_config">
          <h2>Configuración de alertas</h2>
          <dl>
            <div><dt>Categorías</dt><dd>{{ arr(detail.alert_config.categorias) }}</dd></div>
            <div><dt>Regiones</dt><dd>{{ arr(detail.alert_config.regiones) }}</dd></div>
            <div><dt>Palabras clave</dt><dd>{{ arr(detail.alert_config.palabras_clave) }}</dd></div>
            <div><dt>Monto</dt><dd>{{ rango(detail.alert_config.monto_min, detail.alert_config.monto_max) }}</dd></div>
          </dl>
        </div>
        <div class="card empty-card" v-else>
          <h2>Configuración de alertas</h2>
          <p class="empty">Este usuario aún no ha configurado sus alertas.</p>
        </div>

        <!-- Proyectos -->
        <div class="card" v-if="detail.proyectos.length">
          <h2>Proyectos ({{ detail.proyectos.length }})</h2>
          <ul class="proj-list">
            <li v-for="p in detail.proyectos" :key="p.id">
              <span class="proj-name">{{ p.nombre || 'Sin nombre' }}</span>
              <span class="proj-meta">{{ p.estado_proyecto || '—' }} · {{ fmt(p.created_at) }}</span>
            </li>
          </ul>
        </div>

        <!-- Acciones admin -->
        <div class="card actions-card">
          <h2>Acciones de administración</h2>

          <div class="action-row">
            <div>
              <strong>Enviar correo de engagement</strong>
              <p class="action-desc">Envía un correo predefinido a {{ detail.email }}.</p>
            </div>
            <div class="email-controls">
              <select v-model="selectedTemplate" class="tpl-select">
                <option v-for="t in templates" :key="t.key" :value="t.key">{{ t.label }}</option>
              </select>
              <button class="btn-action btn-primary" :disabled="sending" @click="askSendEmail">
                {{ sending ? 'Enviando…' : 'Enviar' }}
              </button>
            </div>
          </div>

          <div class="action-row">
            <div>
              <strong>{{ detail.role === 'admin' ? 'Quitar permisos de admin' : 'Hacer administrador' }}</strong>
              <p class="action-desc">Cambiar el rol concede o revoca acceso total al panel de administración.</p>
            </div>
            <button
              :class="['btn-action', detail.role === 'admin' ? 'btn-neutral' : 'btn-warning']"
              :disabled="togglingRole || isSelf"
              :title="isSelf ? 'No puedes cambiar tu propio rol' : ''"
              @click="askToggleRole"
            >
              {{ detail.role === 'admin' ? 'Quitar admin' : 'Hacer admin' }}
            </button>
          </div>

          <div class="action-row">
            <div>
              <strong>{{ detail.archived_at ? 'Restaurar cuenta' : 'Archivar cuenta' }}</strong>
              <p class="action-desc">Archivar oculta la cuenta del listado sin borrar nada. Reversible.</p>
            </div>
            <button
              :class="['btn-action', detail.archived_at ? 'btn-primary' : 'btn-neutral']"
              :disabled="archiving || isSelf"
              :title="isSelf ? 'No puedes archivar tu propia cuenta' : ''"
              @click="askArchive"
            >
              {{ detail.archived_at ? 'Restaurar' : 'Archivar' }}
            </button>
          </div>
        </div>
      </template>
    </div>

    <ConfirmDialog
      :open="confirmAction !== null"
      :tone="confirmTone"
      :title="confirmTitle"
      :message="confirmMessage"
      :confirm-text="confirmCta"
      :busy="busy"
      @confirm="runConfirm"
      @cancel="confirmAction = null"
    />
  </NuxtLayout>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'], layout: false })

const supabase = useSupabaseClient()
const route = useRoute()
const { show } = useToast()

const targetId = route.params.id as string

interface AlertConfig {
  categorias?: string[]
  regiones?: string[]
  palabras_clave?: string[]
  monto_min?: number | null
  monto_max?: number | null
}
interface Proyecto { id: string; nombre: string | null; estado_proyecto: string | null; created_at: string }
interface Detail {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
  plan: string
  role: string
  plan_status: string
  archived_at: string | null
  is_internal: boolean
  nombre: string | null
  empresa: string | null
  rut: string | null
  counts: { matches: number; matches_no_vistos: number; proyectos: number; guardados: number; postulaciones: number }
  alert_config: AlertConfig | null
  proyectos: Proyecto[]
}

const detail = ref<Detail | null>(null)
const loading = ref(true)
const loadError = ref(false)
const currentUserId = ref('')

const sending = ref(false)
const togglingRole = ref(false)
const archiving = ref(false)

const templates = [
  { key: 'te_extranamos', label: 'Te extrañamos' },
  { key: 'completa_perfil', label: 'Completa tu perfil' },
  { key: 'novedades', label: 'Novedades de la plataforma' },
]
const selectedTemplate = ref(templates[0].key)

const isSelf = computed(() => detail.value?.id === currentUserId.value)

// ── Diálogo de confirmación genérico ─────────────────────────────────────────
type Action = 'email' | 'role' | 'archive'
const confirmAction = ref<Action | null>(null)
const busy = computed(() => sending.value || togglingRole.value || archiving.value)

const confirmTone = computed(() => {
  if (confirmAction.value === 'role' && detail.value?.role !== 'admin') return 'warning'
  if (confirmAction.value === 'archive' && !detail.value?.archived_at) return 'warning'
  return 'primary'
})
const confirmTitle = computed(() => {
  switch (confirmAction.value) {
    case 'email':   return 'Enviar correo'
    case 'role':    return detail.value?.role === 'admin' ? 'Quitar admin' : 'Hacer administrador'
    case 'archive': return detail.value?.archived_at ? 'Restaurar cuenta' : 'Archivar cuenta'
    default:        return ''
  }
})
const confirmMessage = computed(() => {
  if (!detail.value) return ''
  switch (confirmAction.value) {
    case 'email':
      return `Se enviará el correo «${templates.find(t => t.key === selectedTemplate.value)?.label}» a ${detail.value.email}.`
    case 'role':
      return detail.value.role === 'admin'
        ? `${detail.value.email} dejará de tener acceso al panel de administración.`
        : `${detail.value.email} tendrá acceso TOTAL al panel de administración, incluidos finanzas y todos los usuarios. Asegúrate de que confías en esta persona.`
    case 'archive':
      return detail.value.archived_at
        ? `${detail.value.email} volverá a aparecer en el listado.`
        : `${detail.value.email} dejará de aparecer en el listado. No se borra nada y puedes restaurarla cuando quieras.`
    default: return ''
  }
})
const confirmCta = computed(() => {
  switch (confirmAction.value) {
    case 'email':   return 'Enviar'
    case 'role':    return detail.value?.role === 'admin' ? 'Quitar admin' : 'Sí, hacer admin'
    case 'archive': return detail.value?.archived_at ? 'Restaurar' : 'Archivar'
    default:        return 'Confirmar'
  }
})

function askSendEmail()  { confirmAction.value = 'email' }
function askToggleRole() { confirmAction.value = 'role' }
function askArchive()    { confirmAction.value = 'archive' }

async function runConfirm() {
  const action = confirmAction.value
  if (action === 'email')   await doSendEmail()
  if (action === 'role')    await doToggleRole()
  if (action === 'archive') await doArchive()
  confirmAction.value = null
}

async function doSendEmail() {
  sending.value = true
  try {
    await $fetch('/api/admin/send-engagement-email', {
      method: 'POST',
      body: { target_id: targetId, template: selectedTemplate.value },
    })
    show('Correo enviado', 'ok')
  } catch {
    show('No se pudo enviar el correo', 'error')
  }
  sending.value = false
}

async function doToggleRole() {
  if (!detail.value) return
  togglingRole.value = true
  const newRole = detail.value.role === 'admin' ? 'user' : 'admin'
  const { error: err } = await supabase.rpc('admin_set_user_role', { target_id: targetId, new_role: newRole })
  if (err) {
    show('No se pudo cambiar el rol', 'error')
  } else {
    detail.value.role = newRole
    show('Rol actualizado', 'ok')
  }
  togglingRole.value = false
}

async function doArchive() {
  if (!detail.value) return
  archiving.value = true
  const archivar = !detail.value.archived_at
  const { error: err } = await supabase.rpc('admin_set_user_archived', { target_id: targetId, archived: archivar })
  if (err) {
    show('No se pudo actualizar la cuenta', 'error')
  } else {
    detail.value.archived_at = archivar ? new Date().toISOString() : null
    show(archivar ? 'Cuenta archivada' : 'Cuenta restaurada', 'ok')
  }
  archiving.value = false
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
function arr(a?: string[] | null) { return a && a.length ? a.join(', ') : '—' }
function rango(min?: number | null, max?: number | null) {
  if (!min && !max) return '—'
  const f = (n: number) => '$' + n.toLocaleString('es-CL')
  if (min && max) return `${f(min)} – ${f(max)}`
  if (min) return `Desde ${f(min)}`
  return `Hasta ${f(max!)}`
}

onMounted(async () => {
  const { data: { user } } = await supabase.auth.getUser()
  currentUserId.value = user?.id ?? ''

  const { data, error: err } = await supabase.rpc('admin_get_user_detail', { target_id: targetId })
  if (err || !data) {
    loadError.value = true
  } else {
    detail.value = data as unknown as Detail
  }
  loading.value = false
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.content { flex: 1; padding: 2rem 2.5rem; font-family: 'Inter', sans-serif; max-width: 980px; }

.back-link { font-size: 0.85rem; color: #2563eb; text-decoration: none; display: inline-block; margin-bottom: 1.25rem; }
.back-link:hover { text-decoration: underline; }

.header { margin-bottom: 1.5rem; }
h1 { font-size: 1.5rem; font-weight: 700; color: #0f172a; letter-spacing: -0.02em; word-break: break-all; }
.subtitle { display: flex; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap; }

.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
@media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }

.card {
  background: white; border: 1px solid #e2e8f0; border-radius: 12px;
  padding: 1.25rem 1.5rem; margin-bottom: 1rem;
}
.card h2 { font-size: 0.95rem; font-weight: 700; color: #0f172a; margin-bottom: 1rem; }

dl > div { display: flex; justify-content: space-between; gap: 1rem; padding: 0.4rem 0; border-bottom: 1px solid #f1f5f9; }
dl > div:last-child { border-bottom: none; }
dt { font-size: 0.8125rem; color: #64748b; }
dd { font-size: 0.8125rem; color: #0f172a; font-weight: 500; text-align: right; word-break: break-word; }

.metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
@media (max-width: 640px) { .metrics { grid-template-columns: repeat(2, 1fr); } }
.metric { display: flex; flex-direction: column; gap: 0.2rem; padding: 0.5rem 0; }
.metric-num { font-size: 1.75rem; font-weight: 800; color: #0f172a; line-height: 1; }
.metric-label { font-size: 0.8rem; color: #64748b; font-weight: 500; }
.metric-sub { font-size: 0.72rem; color: #d97706; font-weight: 600; }

.proj-list { list-style: none; }
.proj-list li { display: flex; justify-content: space-between; gap: 1rem; padding: 0.5rem 0; border-bottom: 1px solid #f1f5f9; }
.proj-list li:last-child { border-bottom: none; }
.proj-name { font-size: 0.875rem; color: #0f172a; font-weight: 500; }
.proj-meta { font-size: 0.78rem; color: #94a3b8; white-space: nowrap; }

.empty { font-size: 0.85rem; color: #94a3b8; }

.actions-card .action-row {
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  padding: 1rem 0; border-bottom: 1px solid #f1f5f9; flex-wrap: wrap;
}
.actions-card .action-row:last-child { border-bottom: none; }
.action-desc { font-size: 0.8rem; color: #64748b; margin-top: 0.2rem; }

.email-controls { display: flex; gap: 0.5rem; align-items: center; }
.tpl-select {
  padding: 0.5rem 0.75rem; border-radius: 8px; border: 1.5px solid #e2e8f0;
  font-size: 0.85rem; font-family: 'Inter', sans-serif; color: #0f172a; outline: none; cursor: pointer;
}

.btn-action {
  padding: 0.5rem 1rem; border-radius: 8px; font-size: 0.85rem; font-weight: 600;
  cursor: pointer; border: 1.5px solid transparent; font-family: 'Inter', sans-serif;
  transition: all 0.15s; white-space: nowrap;
}
.btn-action:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: #2563eb; color: white; }
.btn-primary:hover:not(:disabled) { background: #1d4ed8; }
.btn-warning { background: #fff7ed; border-color: #fdba74; color: #c2410c; }
.btn-warning:hover:not(:disabled) { background: #ffedd5; }
.btn-neutral { background: #f1f5f9; border-color: #e2e8f0; color: #475569; }
.btn-neutral:hover:not(:disabled) { background: #e2e8f0; }

.badge {
  display: inline-block; padding: 0.2rem 0.6rem; border-radius: 6px;
  font-size: 0.75rem; font-weight: 600; text-transform: capitalize;
}
.badge-free { background: #f1f5f9; color: #475569; }
.badge-starter { background: #eff6ff; color: #2563eb; }
.badge-advanced { background: #ede9fe; color: #6d28d9; }
.badge-agency { background: #e0f2fe; color: #0369a1; }
.badge-admin { background: #fef3c7; color: #b45309; }
.badge-user { background: #f1f5f9; color: #475569; }
.badge-archived { background: #f1f5f9; color: #94a3b8; }
.badge-internal { background: #f0fdf4; color: #15803d; }

.loading, .error { padding: 3rem; text-align: center; color: #64748b; font-size: 0.9rem; }
.error { color: #ef4444; }
</style>
