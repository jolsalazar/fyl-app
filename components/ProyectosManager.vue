<template>
  <div class="pm-root">

    <div class="pm-header">
      <button
        v-if="canAddProyecto(proyectos.length)"
        class="btn-nuevo"
        @click="nuevoProyecto"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Nuevo proyecto
      </button>
      <div v-else class="limit-note">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        Límite de plan · <NuxtLink to="/planes">Mejorar plan</NuxtLink>
      </div>
    </div>

    <!-- Skeleton -->
    <div v-if="loading" class="sk-list">
      <div class="sk-card" style="height:420px;border-radius:16px"></div>
    </div>

    <!-- Sin proyectos -->
    <div v-else-if="proyectos.length === 0 && !editando" class="empty-state">
      <div class="empty-icon">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
      </div>
      <p class="empty-title">Sin proyectos aún</p>
      <p class="empty-desc">Crea tu primer proyecto para activar el módulo de Mis Match.</p>
      <button class="btn-nuevo" @click="nuevoProyecto">Crear primer proyecto</button>
    </div>

    <template v-else>
      <!-- Tabs de proyectos (cuando hay más de 1) -->
      <div v-if="proyectos.length > 1" class="proyectos-tabs">
        <button
          v-for="p in proyectos"
          :key="p.id"
          :class="['proyecto-tab', selectedId === p.id ? 'active' : '', !perfilCompletoProyecto(p) ? 'incompleto' : '']"
          @click="selectProyecto(p.id)"
        >
          <span class="tab-nombre">{{ p.nombre }}</span>
          <span v-if="!perfilCompletoProyecto(p)" class="tab-incompleto" title="Perfil incompleto">!</span>
        </button>
      </div>

      <!-- Formulario del proyecto seleccionado -->
      <form v-if="form" class="form" @submit.prevent="guardar">

        <div v-if="editando && !perfilCompletoForm" class="banner-incompleto">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Completa el tipo de postulante y la etapa del proyecto para activar Mis Match.
        </div>

        <section class="card">
          <div class="card-header"><h2>Nombre del proyecto</h2></div>
          <input v-model="form.nombre" type="text" class="text-input" placeholder='ej: "Startup TI", "Consultora Norte"…' required />
        </section>

        <section class="card">
          <div class="card-header"><h2>Tipo de postulante</h2></div>
          <div class="radios">
            <label class="radio-item">
              <input type="radio" value="natural" v-model="form.tipo_persona" />
              <span class="radio-circle"></span>Persona Natural
            </label>
            <label class="radio-item">
              <input type="radio" value="juridica" v-model="form.tipo_persona" />
              <span class="radio-circle"></span>Persona Jurídica
            </label>
          </div>

          <template v-if="form.tipo_persona === 'natural'">
            <div class="sub-fields">
              <div class="radios">
                <label class="radio-item">
                  <input type="radio" value="no_profesional" v-model="form.subtipo_natural" />
                  <span class="radio-circle"></span>No profesional
                </label>
                <label class="radio-item">
                  <input type="radio" value="profesional" v-model="form.subtipo_natural" />
                  <span class="radio-circle"></span>Profesional
                </label>
              </div>
              <div class="field field-sm">
                <label>Edad</label>
                <input v-model.number="form.edad" type="number" min="18" max="99" placeholder="ej: 32" />
              </div>
            </div>
          </template>

          <template v-if="form.tipo_persona === 'juridica'">
            <div class="sub-fields">
              <div class="field">
                <label>Antigüedad de la empresa</label>
                <select v-model="form.antiguedad_empresa" class="select-input">
                  <option value="">Seleccionar</option>
                  <option value="menos_1">Menos de 1 año</option>
                  <option value="1_3">1 a 3 años</option>
                  <option value="3_5">3 a 5 años</option>
                  <option value="mas_5">Más de 5 años</option>
                </select>
              </div>
            </div>
          </template>
        </section>

        <section class="card">
          <div class="card-header">
            <h2>Estado del proyecto</h2>
            <p class="hint">¿En qué etapa se encuentra tu proyecto?</p>
          </div>
          <div class="radios radios-col">
            <label v-for="e in estados" :key="e.value" class="radio-item">
              <input type="radio" :value="e.value" v-model="form.estado_proyecto" />
              <span class="radio-circle"></span>
              <span class="radio-emoji">{{ e.emoji }}</span>{{ e.label }}
            </label>
          </div>
        </section>

        <template v-if="filtersAvanzados">
          <section class="card">
            <div class="card-header">
              <h2>Foco del proyecto</h2>
              <p class="hint">Selecciona los sectores de tu proyecto. Mejora la precisión del match.</p>
            </div>
            <div class="checks-grid-3">
              <label v-for="f in FOCOS" :key="f" class="check-item">
                <input type="checkbox" :value="f" v-model="form.foco" /><span class="check-box"></span>{{ f }}
              </label>
            </div>
          </section>

          <div class="card-row">
            <section class="card">
              <div class="card-header"><h2>Alcance de interés</h2></div>
              <div class="radios radios-col">
                <label v-for="a in ALCANCES" :key="a.value" class="check-item">
                  <input type="checkbox" :value="a.value" v-model="form.alcance" /><span class="check-box"></span>{{ a.label }}
                </label>
              </div>
            </section>

            <section class="card">
              <div class="card-header">
                <h2>Monto mínimo de interés</h2>
                <p class="hint">Muestra fondos desde este monto.</p>
              </div>
              <select v-model="form.monto_minimo" class="select-input">
                <option value="">Sin límite</option>
                <option v-for="m in MONTOS" :key="m.value" :value="m.value">{{ m.label }}</option>
              </select>
            </section>
          </div>

          <section class="card">
            <div class="card-header">
              <h2>Palabras clave</h2>
              <p class="hint">Términos relevantes de tu proyecto. Enter para agregar.</p>
            </div>
            <div class="tags-input">
              <span v-for="(tag, i) in form.palabras_clave" :key="i" class="tag">
                {{ tag }}<button type="button" @click="removeTag(i)">×</button>
              </span>
              <input v-model="tagInput" type="text" placeholder="ej: exportación, reciclaje…"
                @keydown.enter.prevent="addTag" @keydown.comma.prevent="addTag" />
            </div>
          </section>
        </template>

        <div v-else class="filtros-locked">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Los filtros avanzados (foco, alcance, monto, palabras clave) están disponibles desde el Plan Starter.
          <NuxtLink to="/planes">Ver planes</NuxtLink>
        </div>

        <div class="actions">
          <button v-if="editando && proyectos.length > 1" type="button" class="btn-danger" @click="eliminar">
            Eliminar proyecto
          </button>
          <div style="flex:1"></div>
          <div v-if="mensaje" :class="['mensaje', msgError ? 'error' : 'ok']">{{ mensaje }}</div>
          <button type="submit" :disabled="guardando">
            <span v-if="guardando" class="spinner"></span>
            {{ guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear proyecto' }}
          </button>
        </div>

      </form>
    </template>

  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{ saved: []; deleted: [] }>()

const supabase = useSupabaseClient()
const { canAddProyecto, filtersAvanzados } = usePlan()
const { show: toast } = useToast()

const loading   = ref(true)
const guardando = ref(false)
const mensaje   = ref('')
const msgError  = ref(false)
const tagInput  = ref('')
const editando  = ref<string | null>(null)
const selectedId = ref<string | null>(null)

const proyectos = ref<any[]>([])

const FOCOS = [
  'Agroindustrias', 'Banca y Fintech', 'Climatech', 'Descarbonización',
  'Digitalización', 'Educación', 'Economía Verde', 'I+D+i',
  'Industrial', 'Innovación Social', 'Mujeres', 'Multisectorial',
  'Recursos Forestales', 'Recursos Hídricos', 'Tech',
]
const ALCANCES = [
  { value: 'regional',      label: 'Regional' },
  { value: 'nacional',      label: 'Nacional' },
  { value: 'internacional', label: 'Internacional' },
]
const MONTOS = [
  { value: 'hasta_1M',   label: 'Hasta $1M' },
  { value: '1M_10M',     label: '$1M – $10M' },
  { value: '10M_30M',    label: '$10M – $30M' },
  { value: '30M_60M',    label: '$30M – $60M' },
  { value: '60M_100M',   label: '$60M – $100M' },
  { value: 'sobre_100M', label: 'Más de $100M' },
]
const estados = [
  { value: 'solo_idea',     label: 'Solo idea',               emoji: '💡' },
  { value: 'maqueta',       label: 'Maqueta',                 emoji: '📐' },
  { value: 'prototipo',     label: 'Prototipo funcional',     emoji: '🔧' },
  { value: 'marcha_blanca', label: 'Marcha blanca con ventas',emoji: '🚀' },
  { value: 'crecimiento',   label: 'Buscando crecer',         emoji: '📈' },
]

const emptyForm = () => ({
  nombre:             '',
  tipo_persona:       null as string | null,
  subtipo_natural:    null as string | null,
  edad:               null as number | null,
  antiguedad_empresa: null as string | null,
  estado_proyecto:    null as string | null,
  foco:               [] as string[],
  alcance:            [] as string[],
  monto_minimo:       '',
  palabras_clave:     [] as string[],
})

const form = ref<ReturnType<typeof emptyForm> | null>(null)

const perfilCompletoForm = computed(() =>
  !!form.value?.tipo_persona && !!form.value?.estado_proyecto
)

function perfilCompletoProyecto(p: any) {
  return !!p.tipo_persona && !!p.estado_proyecto
}

onMounted(async () => {
  const { data } = await supabase
    .from('proyectos')
    .select('*')
    .order('created_at', { ascending: true })
  proyectos.value = data ?? []
  loading.value = false

  if (proyectos.value.length > 0) {
    selectProyecto(proyectos.value[0].id)
  }
})

function selectProyecto(id: string) {
  selectedId.value = id
  const p = proyectos.value.find(p => p.id === id)
  if (!p) return
  editando.value = id
  tagInput.value = ''
  form.value = {
    nombre:             p.nombre ?? '',
    tipo_persona:       p.tipo_persona ?? null,
    subtipo_natural:    p.subtipo_natural ?? null,
    edad:               p.edad ?? null,
    antiguedad_empresa: p.antiguedad_empresa ?? null,
    estado_proyecto:    p.estado_proyecto ?? null,
    foco:               [...(p.foco ?? [])],
    alcance:            [...(p.alcance ?? [])],
    monto_minimo:       p.monto_minimo ?? '',
    palabras_clave:     [...(p.palabras_clave ?? [])],
  }
}

function nuevoProyecto() {
  editando.value  = null
  selectedId.value = null
  tagInput.value  = ''
  form.value      = emptyForm()
}

async function guardar() {
  if (!form.value) return
  guardando.value = true
  mensaje.value   = ''

  const payload = {
    nombre:             form.value.nombre.trim() || 'Mi Proyecto',
    tipo_persona:       form.value.tipo_persona,
    subtipo_natural:    form.value.tipo_persona === 'natural' ? form.value.subtipo_natural : null,
    edad:               form.value.tipo_persona === 'natural' ? form.value.edad : null,
    antiguedad_empresa: form.value.tipo_persona === 'juridica' ? form.value.antiguedad_empresa : null,
    estado_proyecto:    form.value.estado_proyecto,
    foco:               form.value.foco,
    alcance:            form.value.alcance,
    monto_minimo:       form.value.monto_minimo || null,
    palabras_clave:     form.value.palabras_clave,
    updated_at:         new Date().toISOString(),
  }

  if (editando.value) {
    const { error } = await supabase.from('proyectos').update(payload).eq('id', editando.value)
    if (error) { msgError.value = true; mensaje.value = 'Error al guardar.' }
    else {
      const idx = proyectos.value.findIndex(p => p.id === editando.value)
      if (idx >= 0) proyectos.value[idx] = { ...proyectos.value[idx], ...payload }
      toast('Proyecto guardado')
      emit('saved')
    }
  } else {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('proyectos').insert({ ...payload, user_id: user!.id }).select().single()
    if (error) { msgError.value = true; mensaje.value = 'Error al crear.' }
    else {
      proyectos.value.push(data)
      editando.value  = data.id
      selectedId.value = data.id
      toast('Proyecto creado')
      emit('saved')
    }
  }
  guardando.value = false
}

async function eliminar() {
  if (!editando.value || !confirm('¿Eliminar este proyecto?')) return
  const { error } = await supabase.from('proyectos').delete().eq('id', editando.value)
  if (!error) {
    proyectos.value = proyectos.value.filter(p => p.id !== editando.value)
    toast('Proyecto eliminado', 'info')
    if (proyectos.value.length > 0) selectProyecto(proyectos.value[0].id)
    else { editando.value = null; selectedId.value = null; form.value = null }
    emit('deleted')
  }
}

function addTag() {
  const val = tagInput.value.trim().replace(',', '')
  if (val && !form.value!.palabras_clave.includes(val)) form.value!.palabras_clave.push(val)
  tagInput.value = ''
}
function removeTag(i: number) { form.value!.palabras_clave.splice(i, 1) }
</script>

<style scoped>
.pm-root { display: flex; flex-direction: column; gap: 1.25rem; font-family: 'Inter', sans-serif; }
.pm-header { display: flex; justify-content: flex-end; }

.btn-nuevo {
  display: inline-flex; align-items: center; gap: 0.4rem;
  padding: 0.55rem 1.125rem; background: #0ea5e9; color: white;
  font-size: 0.875rem; font-weight: 600; font-family: inherit;
  border: none; border-radius: 9px; cursor: pointer; white-space: nowrap;
  transition: background 0.15s; flex-shrink: 0;
}
.btn-nuevo:hover { background: #0284c7; }
.limit-note { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8125rem; color: #94a3b8; }
.limit-note a { color: #0ea5e9; text-decoration: none; }

.proyectos-tabs { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.proyecto-tab {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.5rem 1rem; border-radius: 9px; border: 1.5px solid #e2e8f0;
  font-size: 0.875rem; font-weight: 500; color: #475569;
  background: white; cursor: pointer; font-family: inherit; transition: all 0.15s;
}
.proyecto-tab:hover { border-color: #0ea5e9; color: #0ea5e9; }
.proyecto-tab.active { border-color: #0ea5e9; background: #f0f9ff; color: #0284c7; font-weight: 600; }
.tab-incompleto {
  width: 16px; height: 16px; border-radius: 50%;
  background: #f59e0b; color: white; font-size: 0.6rem;
  font-weight: 800; display: flex; align-items: center; justify-content: center;
}

.form { display: flex; flex-direction: column; gap: 1.25rem; }

.banner-incompleto {
  display: flex; align-items: center; gap: 0.625rem;
  padding: 0.875rem 1rem; background: #fef3c7; border: 1px solid #fde68a;
  border-radius: 10px; font-size: 0.875rem; color: #92400e; line-height: 1.4;
}

.card { background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1.5rem; }
.card-header { margin-bottom: 1.125rem; }
.card-header h2 { font-size: 0.9375rem; font-weight: 700; color: #0f172a; margin-bottom: 0.2rem; }
.hint { font-size: 0.8125rem; color: #94a3b8; }

.card-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }

.text-input {
  width: 100%; padding: 0.7rem 0.875rem; border: 1.5px solid #e2e8f0;
  border-radius: 10px; font-size: 0.9375rem; font-family: inherit; outline: none;
  transition: border-color 0.15s; color: #0f172a; background: #fafafa;
}
.text-input:focus { border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(14,165,233,0.1); background: white; }

.radios     { display: flex; gap: 1.5rem; flex-wrap: wrap; }
.radios-col { flex-direction: column; gap: 0.75rem; }
.radio-item { display: flex; align-items: center; gap: 0.625rem; font-size: 0.9rem; color: #374151; cursor: pointer; user-select: none; }
.radio-item input[type="radio"] { display: none; }
.radio-circle { width: 18px; height: 18px; border: 1.5px solid #cbd5e1; border-radius: 50%; flex-shrink: 0; transition: all 0.15s; background: white; }
.radio-item input:checked + .radio-circle { border-color: #0ea5e9; border-width: 5px; }
.radio-emoji { font-size: 1rem; }

.sub-fields { margin-top: 1.125rem; padding-top: 1.125rem; border-top: 1px solid #f1f5f9; display: flex; flex-direction: column; gap: 1rem; }
.field label { display: block; font-size: 0.8125rem; font-weight: 600; color: #374151; margin-bottom: 0.4rem; }
.field input { width: 100%; padding: 0.6rem 0.75rem; border: 1.5px solid #e2e8f0; border-radius: 9px; font-size: 0.9rem; font-family: inherit; outline: none; transition: border-color 0.15s; color: #0f172a; }
.field input:focus { border-color: #0ea5e9; }
.field-sm { max-width: 180px; }

.select-input {
  width: 100%; padding: 0.6rem 0.75rem; border: 1.5px solid #e2e8f0; border-radius: 9px;
  font-size: 0.9rem; font-family: inherit; outline: none; background: white; color: #0f172a;
  cursor: pointer; appearance: none; transition: border-color 0.15s;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 0.75rem center; padding-right: 2.25rem;
}
.select-input:focus { border-color: #0ea5e9; }

.checks-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.6rem; }
.check-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; color: #374151; cursor: pointer; user-select: none; }
.check-item input[type="checkbox"] { display: none; }
.check-box { width: 17px; height: 17px; border: 1.5px solid #cbd5e1; border-radius: 4px; flex-shrink: 0; transition: all 0.15s; position: relative; background: white; }
.check-item input:checked + .check-box { background: #0ea5e9; border-color: #0ea5e9; }
.check-item input:checked + .check-box::after { content: ''; position: absolute; left: 3px; top: 1px; width: 6px; height: 9px; border: 2px solid white; border-top: none; border-left: none; transform: rotate(45deg); }

.tags-input { display: flex; flex-wrap: wrap; gap: 0.4rem; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 0.5rem 0.625rem; background: #fafafa; transition: all 0.15s; }
.tags-input:focus-within { border-color: #0ea5e9; background: white; }
.tags-input input { border: none; background: transparent; padding: 0.2rem 0.25rem; flex: 1; min-width: 120px; font-size: 0.9rem; font-family: inherit; outline: none; color: #0f172a; }
.tag { display: flex; align-items: center; gap: 0.25rem; background: #e0f2fe; color: #0284c7; font-size: 0.8rem; font-weight: 600; padding: 0.18rem 0.45rem 0.18rem 0.65rem; border-radius: 999px; }
.tag button { background: none; border: none; color: #7dd3fc; cursor: pointer; font-size: 1rem; padding: 0; line-height: 1; }

.filtros-locked {
  display: flex; align-items: center; gap: 0.625rem; flex-wrap: wrap;
  padding: 1rem 1.25rem; background: #f8fafc; border: 1.5px solid #e2e8f0;
  border-radius: 12px; font-size: 0.875rem; color: #64748b;
}
.filtros-locked a { color: #0ea5e9; text-decoration: none; font-weight: 500; }

.actions { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
.btn-danger {
  padding: 0.6rem 1rem; background: none; border: 1.5px solid #fca5a5;
  color: #dc2626; font-size: 0.875rem; font-weight: 500; font-family: inherit;
  border-radius: 9px; cursor: pointer; transition: all 0.15s;
}
.btn-danger:hover { background: #fef2f2; }

.mensaje { font-size: 0.875rem; font-weight: 500; padding: 0.5rem 0.875rem; border-radius: 8px; }
.mensaje.ok    { background: #f0fdf4; color: #16a34a; }
.mensaje.error { background: #fef2f2; color: #dc2626; }

button[type="submit"] {
  padding: 0.7rem 1.75rem; background: #0ea5e9; color: white; font-size: 0.9375rem;
  font-weight: 600; font-family: inherit; border: none; border-radius: 10px;
  cursor: pointer; transition: background 0.15s; display: flex; align-items: center; gap: 0.5rem;
}
button[type="submit"]:hover:not(:disabled) { background: #0284c7; }
button[type="submit"]:disabled { opacity: 0.6; cursor: not-allowed; }
.spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.65s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.sk-list { display: flex; flex-direction: column; gap: 1rem; }
.sk-card { background: linear-gradient(90deg, #f1f5f9 25%, #e8edf3 50%, #f1f5f9 75%); background-size: 1200px 100%; animation: shimmer 1.5s infinite; }
@keyframes shimmer { from { background-position: -600px 0; } to { background-position: 600px 0; } }

.empty-state { display: flex; flex-direction: column; align-items: center; padding: 4rem 2rem; text-align: center; gap: 0.75rem; }
.empty-icon { width: 60px; height: 60px; background: #f1f5f9; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: #94a3b8; margin-bottom: 0.25rem; }
.empty-title { font-size: 1rem; font-weight: 600; color: #0f172a; }
.empty-desc { font-size: 0.875rem; color: #64748b; max-width: 340px; line-height: 1.5; }

@media (max-width: 640px) {
  .checks-grid-3 { grid-template-columns: 1fr 1fr; }
  .card-row { grid-template-columns: 1fr; }
}
</style>
