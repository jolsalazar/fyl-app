<template>
  <NuxtLayout name="dashboard">
    <div class="content">
      <NuxtLink to="/dashboard/admin/usuarios" class="back-link">← Volver al listado</NuxtLink>

      <div v-if="loading" class="loading">Cargando usuario…</div>
      <div v-else-if="loadError" class="error">No se pudo cargar este usuario.</div>

      <template v-else-if="detail">
        <!-- ── Header ───────────────────────────────────────────── -->
        <div class="header">
          <div class="avatar">{{ inicial }}</div>
          <div class="header-main">
            <h1>{{ detail.email }}</h1>
            <div class="badges">
              <span :class="['badge', detail.role === 'admin' ? 'badge-admin' : 'badge-user']">{{ detail.role === 'admin' ? 'Administrador' : 'Usuario' }}</span>
              <span v-if="detail.role !== 'admin'" :class="['badge', `badge-${detail.plan}`]">Plan {{ detail.plan }}</span>
              <span v-if="detail.plan_status !== 'active'" class="badge badge-warn">{{ detail.plan_status }}</span>
              <span v-if="!detail.onboarding_done" class="badge badge-warn">Onboarding pendiente</span>
              <span v-if="detail.archived_at" class="badge badge-archived">Archivada</span>
              <span v-if="detail.is_internal" class="badge badge-internal">Interna</span>
            </div>
          </div>
        </div>

        <!-- ── Cuenta ───────────────────────────────────────────── -->
        <div class="card">
          <h2>Cuenta</h2>
          <div class="facts">
            <div class="fact"><span class="fact-k">Registro</span><span class="fact-v">{{ fmt(detail.created_at) }}</span></div>
            <div class="fact"><span class="fact-k">Último ingreso</span><span class="fact-v">{{ detail.last_sign_in_at ? fmt(detail.last_sign_in_at) : 'Nunca' }}</span></div>
            <div class="fact"><span class="fact-k">Onboarding</span><span class="fact-v">{{ detail.onboarding_done ? 'Completo' : 'Pendiente' }}</span></div>
            <div class="fact"><span class="fact-k">Estado del plan</span><span class="fact-v">{{ detail.plan_status }}</span></div>
            <div v-if="detail.intended_plan && detail.intended_plan !== detail.plan" class="fact">
              <span class="fact-k">Plan que quería</span><span class="fact-v">{{ detail.intended_plan }}</span>
            </div>
            <div v-if="detail.plan_expires_at" class="fact">
              <span class="fact-k">Vence el plan</span><span class="fact-v">{{ fmt(detail.plan_expires_at) }}</span>
            </div>
            <div v-if="detail.archived_at" class="fact"><span class="fact-k">Archivada</span><span class="fact-v">{{ fmt(detail.archived_at) }}</span></div>
          </div>
        </div>

        <!-- ── Actividad ────────────────────────────────────────── -->
        <div class="card">
          <h2>Actividad</h2>
          <div class="metrics">
            <div class="metric">
              <span class="metric-num">{{ detail.counts.matches }}</span>
              <span class="metric-label">Matches</span>
              <span v-if="detail.counts.matches_no_vistos" class="metric-sub">{{ detail.counts.matches_no_vistos }} sin ver</span>
            </div>
            <div class="metric"><span class="metric-num">{{ detail.counts.alertas }}</span><span class="metric-label">Alertas</span></div>
            <div class="metric"><span class="metric-num">{{ detail.counts.proyectos }}</span><span class="metric-label">Proyectos</span></div>
            <div class="metric"><span class="metric-num">{{ detail.counts.guardados }}</span><span class="metric-label">Guardados</span></div>
            <div class="metric"><span class="metric-num">{{ detail.counts.postulaciones }}</span><span class="metric-label">Postulaciones</span></div>
          </div>
        </div>

        <!-- ── Perfil del postulante ────────────────────────────── -->
        <div class="card">
          <h2>Perfil del postulante</h2>
          <template v-if="detail.perfil && perfilTieneDatos">
            <div class="facts">
              <div v-if="detail.perfil.tipo_persona" class="fact">
                <span class="fact-k">Tipo</span>
                <span class="fact-v">{{ tipoPersonaLabel(detail.perfil.tipo_persona) }}<template v-if="detail.perfil.subtipo_natural"> · {{ subtipoLabel(detail.perfil.subtipo_natural) }}</template></span>
              </div>
              <div v-if="detail.perfil.edad" class="fact"><span class="fact-k">Edad</span><span class="fact-v">{{ detail.perfil.edad }} años</span></div>
              <div v-if="detail.perfil.antiguedad_empresa" class="fact"><span class="fact-k">Antigüedad empresa</span><span class="fact-v">{{ antiguedadLabel(detail.perfil.antiguedad_empresa) }}</span></div>
              <div v-if="detail.perfil.estado_proyecto" class="fact"><span class="fact-k">Etapa del proyecto</span><span class="fact-v">{{ estadoLabel(detail.perfil.estado_proyecto) }}</span></div>
            </div>
            <div v-if="detail.perfil.foco_proyecto?.length" class="chip-row">
              <span class="chip-label">Foco</span>
              <span v-for="f in detail.perfil.foco_proyecto" :key="f" class="chip">{{ f }}</span>
            </div>
            <div v-if="detail.perfil.palabras_clave?.length" class="chip-row">
              <span class="chip-label">Palabras clave</span>
              <span v-for="k in detail.perfil.palabras_clave" :key="k" class="chip chip-kw">{{ k }}</span>
            </div>
          </template>
          <p v-else class="empty">Este usuario aún no completó su perfil en el onboarding.</p>
        </div>

        <!-- ── Alertas ──────────────────────────────────────────── -->
        <div class="card">
          <h2>Alertas <span class="count">{{ detail.alertas.length }}</span></h2>
          <p v-if="!detail.alertas.length" class="empty">Este usuario aún no ha configurado alertas.</p>
          <div v-else class="alert-list">
            <div v-for="a in detail.alertas" :key="a.id" class="alert-item">
              <div class="alert-head">
                <span class="alert-name">{{ a.nombre || 'Sin nombre' }}</span>
                <span :class="['dot', a.activo ? 'dot-on' : 'dot-off']">{{ a.activo ? 'Activa' : 'Pausada' }}</span>
              </div>
              <div class="alert-tags">
                <span v-for="t in (a.tipos || [])" :key="'t'+t" class="chip chip-sky">{{ tipoLabel(t) }}</span>
                <span v-for="f in (a.fuentes || [])" :key="'f'+f" class="chip">{{ fuenteLabel(f) }}</span>
                <span v-if="!a.fuentes?.length" class="chip chip-muted">Todas las fuentes</span>
                <span v-for="k in (a.palabras_clave || [])" :key="'k'+k" class="chip chip-kw">{{ k }}</span>
              </div>
              <div class="alert-meta">
                Creada {{ a.created_at ? fmtCorto(a.created_at) : '—' }}
                · Última notificación {{ a.last_notified_at ? fmtCorto(a.last_notified_at) : 'nunca' }}
              </div>
            </div>
          </div>
        </div>

        <!-- ── Proyectos ────────────────────────────────────────── -->
        <div class="card" v-if="detail.proyectos.length">
          <h2>Proyectos <span class="count">{{ detail.proyectos.length }}</span></h2>
          <div class="alert-list">
            <div v-for="p in detail.proyectos" :key="p.id" class="alert-item">
              <div class="alert-head">
                <span class="alert-name">{{ p.nombre || 'Sin nombre' }}</span>
                <span v-if="p.estado_proyecto" class="chip chip-sky">{{ estadoLabel(p.estado_proyecto) }}</span>
              </div>
              <div v-if="p.foco?.length" class="alert-tags">
                <span v-for="f in p.foco" :key="f" class="chip">{{ f }}</span>
              </div>
              <div class="alert-meta">Creado {{ fmtCorto(p.created_at) }}</div>
            </div>
          </div>
        </div>

        <!-- ── Acciones admin ───────────────────────────────────── -->
        <div class="card actions-card">
          <h2>Acciones de administración</h2>

          <div class="action-row">
            <div>
              <strong>Corregir correo</strong>
              <p class="action-desc">Cambia el email de acceso (p. ej. un typo al registrarse). Queda confirmado al instante.</p>
            </div>
            <div class="email-controls">
              <input
                v-model="nuevoEmail"
                type="email"
                class="email-input"
                placeholder="correo corregido"
                :disabled="updatingEmail"
              />
              <button
                class="btn-action btn-primary"
                :disabled="updatingEmail || !emailCorregidoValido"
                @click="askUpdateEmail"
              >
                {{ updatingEmail ? 'Guardando…' : 'Guardar' }}
              </button>
            </div>
          </div>

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

interface Perfil {
  tipo_persona: string | null
  subtipo_natural: string | null
  edad: number | null
  antiguedad_empresa: string | null
  estado_proyecto: string | null
  foco_proyecto: string[] | null
  palabras_clave: string[] | null
  updated_at: string | null
}
interface Alerta {
  id: string
  nombre: string | null
  activo: boolean
  tipos: string[] | null
  fuentes: string[] | null
  foco: string[] | null
  palabras_clave: string[] | null
  alcance_interes: string[] | null
  monto_rangos: string[] | null
  monto_minimo: string | null
  created_at: string | null
  last_notified_at: string | null
}
interface Proyecto {
  id: string
  nombre: string | null
  estado_proyecto: string | null
  foco: string[] | null
  monto_minimo: string | null
  created_at: string
}
interface Detail {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
  plan: string
  role: string
  plan_status: string
  intended_plan: string | null
  plan_expires_at: string | null
  onboarding_done: boolean
  archived_at: string | null
  is_internal: boolean
  counts: { matches: number; matches_no_vistos: number; proyectos: number; guardados: number; postulaciones: number; alertas: number }
  perfil: Perfil | null
  alertas: Alerta[]
  proyectos: Proyecto[]
}

const detail = ref<Detail | null>(null)
const loading = ref(true)
const loadError = ref(false)
const currentUserId = ref('')

const sending = ref(false)
const togglingRole = ref(false)
const archiving = ref(false)
const updatingEmail = ref(false)

const nuevoEmail = ref('')
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const emailCorregidoValido = computed(() => {
  const v = nuevoEmail.value.trim().toLowerCase()
  return EMAIL_RE.test(v) && v !== detail.value?.email?.toLowerCase()
})

const templates = [
  { key: 'te_extranamos', label: 'Te extrañamos' },
  { key: 'completa_perfil', label: 'Completa tu perfil' },
  { key: 'novedades', label: 'Novedades de la plataforma' },
]
const selectedTemplate = ref(templates[0].key)

const isSelf = computed(() => detail.value?.id === currentUserId.value)
const inicial = computed(() => detail.value?.email?.[0]?.toUpperCase() ?? '?')
const perfilTieneDatos = computed(() => {
  const p = detail.value?.perfil
  if (!p) return false
  return !!(p.tipo_persona || p.estado_proyecto || p.edad || p.antiguedad_empresa
    || p.foco_proyecto?.length || p.palabras_clave?.length)
})

// ── Etiquetas legibles (mismos valores que el onboarding) ────────────────────
const TIPO_PERSONA: Record<string, string> = { natural: 'Persona natural', juridica: 'Empresa (persona jurídica)' }
const SUBTIPO: Record<string, string> = { no_profesional: 'No profesional', profesional: 'Profesional' }
const ANTIGUEDAD: Record<string, string> = { menos_1: 'Menos de 1 año', '1_3': '1 a 3 años', '3_5': '3 a 5 años', mas_5: 'Más de 5 años' }
const ESTADO: Record<string, string> = {
  solo_idea: 'Solo idea', maqueta: 'Maqueta', prototipo: 'Prototipo funcional',
  marcha_blanca: 'Marcha blanca con ventas', crecimiento: 'Buscando crecer',
}
const FUENTE: Record<string, string> = {
  corfo: 'CORFO', sercotec: 'SERCOTEC', anid: 'ANID',
  mercadopublico: 'Mercado Público', fondos_gob: 'Fondos.gob.cl', fondos_cultura: 'Fondos Cultura',
  santander_x: 'Santander X',
}
const TIPO: Record<string, string> = { fondo: 'Fondos concursables', licitacion: 'Licitaciones' }

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')
const tipoPersonaLabel = (v: string) => TIPO_PERSONA[v] ?? cap(v)
const subtipoLabel = (v: string) => SUBTIPO[v] ?? cap(v)
const antiguedadLabel = (v: string) => ANTIGUEDAD[v] ?? cap(v)
const estadoLabel = (v: string) => ESTADO[v] ?? cap(v)
const fuenteLabel = (v: string) => FUENTE[v] ?? cap(v)
const tipoLabel = (v: string) => TIPO[v] ?? cap(v)

// ── Diálogo de confirmación genérico ─────────────────────────────────────────
type Action = 'email' | 'role' | 'archive' | 'update_email'
const confirmAction = ref<Action | null>(null)
const busy = computed(() => sending.value || togglingRole.value || archiving.value || updatingEmail.value)

const confirmTone = computed(() => {
  if (confirmAction.value === 'role' && detail.value?.role !== 'admin') return 'warning'
  if (confirmAction.value === 'archive' && !detail.value?.archived_at) return 'warning'
  if (confirmAction.value === 'update_email') return 'warning'
  return 'primary'
})
const confirmTitle = computed(() => {
  switch (confirmAction.value) {
    case 'email':        return 'Enviar correo'
    case 'update_email': return 'Corregir correo'
    case 'role':         return detail.value?.role === 'admin' ? 'Quitar admin' : 'Hacer administrador'
    case 'archive':      return detail.value?.archived_at ? 'Restaurar cuenta' : 'Archivar cuenta'
    default:             return ''
  }
})
const confirmMessage = computed(() => {
  if (!detail.value) return ''
  switch (confirmAction.value) {
    case 'email':
      return `Se enviará el correo «${templates.find(t => t.key === selectedTemplate.value)?.label}» a ${detail.value.email}.`
    case 'update_email':
      return `El correo de acceso cambiará de ${detail.value.email} a ${nuevoEmail.value.trim().toLowerCase()} y quedará confirmado. El usuario deberá usar el nuevo correo para iniciar sesión (su contraseña no cambia).`
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
    case 'email':        return 'Enviar'
    case 'update_email': return 'Sí, corregir'
    case 'role':         return detail.value?.role === 'admin' ? 'Quitar admin' : 'Sí, hacer admin'
    case 'archive':      return detail.value?.archived_at ? 'Restaurar' : 'Archivar'
    default:             return 'Confirmar'
  }
})

function askSendEmail()   { confirmAction.value = 'email' }
function askToggleRole()  { confirmAction.value = 'role' }
function askArchive()     { confirmAction.value = 'archive' }
function askUpdateEmail() {
  if (!emailCorregidoValido.value) return
  confirmAction.value = 'update_email'
}

async function runConfirm() {
  const action = confirmAction.value
  if (action === 'email')        await doSendEmail()
  if (action === 'role')         await doToggleRole()
  if (action === 'archive')      await doArchive()
  if (action === 'update_email') await doUpdateEmail()
  confirmAction.value = null
}

async function doUpdateEmail() {
  if (!detail.value) return
  updatingEmail.value = true
  try {
    const res = await $fetch<{ ok: boolean; new_email?: string; error?: string }>(
      '/api/admin/update-email',
      { method: 'POST', body: { target_id: targetId, new_email: nuevoEmail.value.trim().toLowerCase() } },
    )
    if (res.ok && res.new_email) {
      detail.value.email = res.new_email
      nuevoEmail.value = ''
      show('Correo corregido', 'ok')
    } else {
      show(res.error === 'update_failed' ? 'Ese correo ya está en uso' : 'No se pudo corregir el correo', 'error')
    }
  } catch {
    show('No se pudo corregir el correo', 'error')
  }
  updatingEmail.value = false
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
function fmtCorto(iso: string) {
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
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

.content { flex: 1; padding: 2rem 2.5rem; font-family: 'Inter', sans-serif; max-width: 920px; }

.back-link { font-size: 0.85rem; color: #2563eb; text-decoration: none; display: inline-block; margin-bottom: 1.25rem; }
.back-link:hover { text-decoration: underline; }

/* Header con avatar */
.header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
.avatar {
  width: 52px; height: 52px; flex-shrink: 0; border-radius: 14px;
  background: linear-gradient(135deg, #2563eb, #0ea5e9); color: white;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.5rem; font-weight: 800;
}
.header-main { min-width: 0; }
h1 { font-size: 1.4rem; font-weight: 700; color: #0f172a; letter-spacing: -0.02em; word-break: break-all; }
.badges { display: flex; gap: 0.4rem; margin-top: 0.5rem; flex-wrap: wrap; }

.card {
  background: white; border: 1px solid #e8edf3; border-radius: 14px;
  padding: 1.25rem 1.5rem; margin-bottom: 1rem;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}
.card h2 {
  font-size: 0.78rem; font-weight: 700; color: #64748b; margin-bottom: 1rem;
  text-transform: uppercase; letter-spacing: 0.06em;
  display: flex; align-items: center; gap: 0.5rem;
}
.count {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 1.25rem; height: 1.25rem; padding: 0 0.35rem;
  background: #eff6ff; color: #2563eb; border-radius: 6px; font-size: 0.72rem; font-weight: 700;
}

/* Facts (clave/valor en grilla) */
.facts { display: grid; grid-template-columns: 1fr 1fr; gap: 0.1rem 1.5rem; }
@media (max-width: 560px) { .facts { grid-template-columns: 1fr; } }
.fact { display: flex; justify-content: space-between; gap: 1rem; padding: 0.5rem 0; border-bottom: 1px solid #f1f5f9; }
.fact-k { font-size: 0.8125rem; color: #64748b; }
.fact-v { font-size: 0.8125rem; color: #0f172a; font-weight: 600; text-align: right; word-break: break-word; }

/* Chips */
.chip-row { display: flex; align-items: center; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.9rem; }
.chip-label { font-size: 0.75rem; color: #94a3b8; font-weight: 600; margin-right: 0.25rem; }
.chip {
  display: inline-block; padding: 0.25rem 0.6rem; border-radius: 999px;
  background: #f1f5f9; color: #475569; font-size: 0.76rem; font-weight: 600;
}
.chip-kw { background: #fef9c3; color: #854d0e; }
.chip-sky { background: #e0f2fe; color: #0369a1; }
.chip-muted { background: transparent; color: #94a3b8; border: 1px dashed #cbd5e1; }

/* Métricas */
.metrics { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; }
@media (max-width: 640px) { .metrics { grid-template-columns: repeat(3, 1fr); } }
.metric { display: flex; flex-direction: column; gap: 0.2rem; padding: 0.25rem 0; }
.metric-num { font-size: 1.6rem; font-weight: 800; color: #0f172a; line-height: 1; }
.metric-label { font-size: 0.78rem; color: #64748b; font-weight: 500; }
.metric-sub { font-size: 0.7rem; color: #d97706; font-weight: 600; }

/* Lista de alertas / proyectos */
.alert-list { display: flex; flex-direction: column; gap: 0.75rem; }
.alert-item { border: 1px solid #eef2f7; border-radius: 10px; padding: 0.85rem 1rem; background: #fafbfc; }
.alert-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap; }
.alert-name { font-size: 0.9rem; font-weight: 700; color: #0f172a; }
.alert-tags { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.6rem; }
.alert-meta { font-size: 0.74rem; color: #94a3b8; margin-top: 0.6rem; }
.dot { font-size: 0.72rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 999px; }
.dot-on { background: #dcfce7; color: #15803d; }
.dot-off { background: #f1f5f9; color: #94a3b8; }

.empty { font-size: 0.85rem; color: #94a3b8; }

/* Acciones admin */
.actions-card .action-row {
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
  padding: 1rem 0; border-bottom: 1px solid #f1f5f9; flex-wrap: wrap;
}
.actions-card .action-row:last-child { border-bottom: none; }
.action-row strong { font-size: 0.9rem; color: #0f172a; }
.action-desc { font-size: 0.8rem; color: #64748b; margin-top: 0.2rem; }

.email-controls { display: flex; gap: 0.5rem; align-items: center; }
.tpl-select {
  padding: 0.5rem 0.75rem; border-radius: 8px; border: 1.5px solid #e2e8f0;
  font-size: 0.85rem; font-family: 'Inter', sans-serif; color: #0f172a; outline: none; cursor: pointer;
}
.email-input {
  padding: 0.5rem 0.75rem; border-radius: 8px; border: 1.5px solid #e2e8f0;
  font-size: 0.85rem; font-family: 'Inter', sans-serif; color: #0f172a; outline: none; min-width: 220px;
}
.email-input:focus { border-color: #2563eb; }

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
.badge-warn { background: #fef3c7; color: #b45309; }

.loading, .error { padding: 3rem; text-align: center; color: #64748b; font-size: 0.9rem; }
.error { color: #ef4444; }
</style>
