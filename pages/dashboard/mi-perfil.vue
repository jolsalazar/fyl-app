<template>
  <NuxtLayout name="dashboard">
    <div class="content">

      <div class="page-hero">
        <div class="hero-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <div>
          <h1>Mi Perfil Postulante</h1>
          <p class="hero-desc">Completar tu perfil nos permite mostrarte si calificas para cada fondo y encontrar los que mejor calzan con tu proyecto. Solo lo haces una vez.</p>
        </div>
      </div>

      <form class="form" @submit.prevent="guardar">

        <!-- Tipo de postulante -->
        <section class="card">
          <div class="card-header">
            <h2>Tipo de postulante</h2>
          </div>
          <div class="radios">
            <label class="radio-item">
              <input type="radio" value="natural" v-model="perfil.tipo_persona" />
              <span class="radio-circle"></span>
              Persona Natural
            </label>
            <label class="radio-item">
              <input type="radio" value="juridica" v-model="perfil.tipo_persona" />
              <span class="radio-circle"></span>
              Persona Jurídica
            </label>
          </div>

          <template v-if="perfil.tipo_persona === 'natural'">
            <div class="sub-fields">
              <div class="radios">
                <label class="radio-item">
                  <input type="radio" value="no_profesional" v-model="perfil.subtipo_natural" />
                  <span class="radio-circle"></span>
                  No profesional
                </label>
                <label class="radio-item">
                  <input type="radio" value="profesional" v-model="perfil.subtipo_natural" />
                  <span class="radio-circle"></span>
                  Profesional
                </label>
              </div>
              <div class="field field-sm">
                <label>Edad</label>
                <input v-model.number="perfil.edad" type="number" min="18" max="99" placeholder="ej: 32" />
              </div>
            </div>
          </template>

          <template v-if="perfil.tipo_persona === 'juridica'">
            <div class="sub-fields">
              <div class="field">
                <label>Antigüedad de la empresa</label>
                <select v-model="perfil.antiguedad_empresa" class="select-input">
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

        <!-- Estado del proyecto -->
        <section class="card">
          <div class="card-header">
            <h2>Estado del proyecto</h2>
            <p class="hint">¿En qué etapa se encuentra tu proyecto o emprendimiento?</p>
          </div>
          <div class="radios radios-col">
            <label v-for="e in estados" :key="e.value" class="radio-item">
              <input type="radio" :value="e.value" v-model="perfil.estado_proyecto" />
              <span class="radio-circle"></span>
              {{ e.label }}
            </label>
          </div>
        </section>

        <!-- Foco del proyecto -->
        <section class="card">
          <div class="card-header">
            <h2>Foco del proyecto</h2>
            <p class="hint">Selecciona los sectores que mejor describen tu proyecto. Selección múltiple.</p>
          </div>
          <div class="checks-grid-3">
            <label v-for="f in focos" :key="f" class="check-item">
              <input type="checkbox" :value="f" v-model="perfil.foco_proyecto" />
              <span class="check-box"></span>
              {{ f }}
            </label>
          </div>
        </section>

        <!-- Palabras clave -->
        <section class="card">
          <div class="card-header">
            <h2>Palabras clave del proyecto</h2>
            <p class="hint">Describe tu proyecto con palabras sueltas. Presiona Enter para agregar.</p>
          </div>
          <div class="tags-input">
            <span v-for="(tag, i) in perfil.palabras_clave" :key="i" class="tag">
              {{ tag }}<button type="button" @click="removeTag(i)">×</button>
            </span>
            <input
              v-model="tagInput"
              type="text"
              placeholder="ej: reciclaje, software, exportación…"
              @keydown.enter.prevent="addTag"
              @keydown.comma.prevent="addTag"
            />
          </div>
        </section>

        <div class="actions">
          <div v-if="mensaje" :class="['mensaje', error ? 'error' : 'ok']">{{ mensaje }}</div>
          <button type="submit" :disabled="guardando">
            <span v-if="guardando" class="spinner"></span>
            {{ guardando ? 'Guardando...' : 'Guardar perfil' }}
          </button>
        </div>

      </form>
    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: false })

const supabase = useSupabaseClient()

const guardando = ref(false)
const mensaje   = ref('')
const error     = ref(false)
const tagInput  = ref('')

const perfil = ref({
  tipo_persona:       null as string | null,
  subtipo_natural:    null as string | null,
  edad:               null as number | null,
  antiguedad_empresa: null as string | null,
  estado_proyecto:    null as string | null,
  foco_proyecto:      [] as string[],
  palabras_clave:     [] as string[],
})

const estados = [
  { value: 'solo_idea',     label: 'Solo idea' },
  { value: 'maqueta',       label: 'Maqueta' },
  { value: 'prototipo',     label: 'Prototipo funcional' },
  { value: 'marcha_blanca', label: 'Marcha blanca con ventas' },
  { value: 'crecimiento',   label: 'Buscando crecer y expandirme' },
]

const focos = [
  'Agroindustrias', 'Banca y Fintech', 'Climatech', 'Descarbonización',
  'Digitalización', 'Educación', 'Economía Verde', 'I+D+i',
  'Industrial', 'Innovación Social', 'Mujeres', 'Multisectorial',
  'Recursos Forestales', 'Recursos Hídricos', 'Tech',
]

function addTag() {
  const val = tagInput.value.trim().replace(',', '')
  if (val && !perfil.value.palabras_clave.includes(val))
    perfil.value.palabras_clave.push(val)
  tagInput.value = ''
}
function removeTag(i: number) {
  perfil.value.palabras_clave.splice(i, 1)
}

onMounted(async () => {
  const { data: { user } } = await supabase.auth.getUser()
  const { data } = await supabase
    .from('perfil_postulante')
    .select('tipo_persona, subtipo_natural, edad, antiguedad_empresa, estado_proyecto, foco_proyecto, palabras_clave')
    .eq('user_id', user!.id)
    .maybeSingle()
  if (data) {
    perfil.value = {
      tipo_persona:       data.tipo_persona ?? null,
      subtipo_natural:    data.subtipo_natural ?? null,
      edad:               data.edad ?? null,
      antiguedad_empresa: data.antiguedad_empresa ?? null,
      estado_proyecto:    data.estado_proyecto ?? null,
      foco_proyecto:      data.foco_proyecto ?? [],
      palabras_clave:     data.palabras_clave ?? [],
    }
  }
})

async function guardar() {
  guardando.value = true
  mensaje.value   = ''
  const { data: { user } } = await supabase.auth.getUser()
  const { error: err } = await supabase
    .from('perfil_postulante')
    .upsert({
      user_id:            user!.id,
      tipo_persona:       perfil.value.tipo_persona,
      subtipo_natural:    perfil.value.tipo_persona === 'natural' ? perfil.value.subtipo_natural : null,
      edad:               perfil.value.tipo_persona === 'natural' ? perfil.value.edad : null,
      antiguedad_empresa: perfil.value.tipo_persona === 'juridica' ? perfil.value.antiguedad_empresa : null,
      estado_proyecto:    perfil.value.estado_proyecto,
      foco_proyecto:      perfil.value.foco_proyecto,
      palabras_clave:     perfil.value.palabras_clave,
      updated_at:         new Date().toISOString(),
    }, { onConflict: 'user_id' })
  error.value   = !!err
  mensaje.value = err ? 'Error al guardar.' : '✓ Perfil guardado'
  guardando.value = false
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.content { flex: 1; padding: 2.5rem; font-family: 'Inter', sans-serif; }

.page-hero {
  display: flex; align-items: flex-start; gap: 1rem;
  margin-bottom: 2rem; padding: 1.5rem; background: #f0f9ff;
  border: 1px solid #bae6fd; border-radius: 14px;
}
.hero-icon {
  width: 44px; height: 44px; flex-shrink: 0;
  background: #0ea5e9; border-radius: 10px;
  display: flex; align-items: center; justify-content: center; color: white;
}
h1 { font-size: 1.25rem; font-weight: 700; color: #0f172a; letter-spacing: -0.02em; }
.hero-desc { font-size: 0.875rem; color: #0369a1; margin-top: 0.25rem; line-height: 1.55; max-width: 560px; }

.form { display: flex; flex-direction: column; gap: 1.25rem; max-width: 600px; }
.card { background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1.5rem; }
.card-header { margin-bottom: 1.125rem; }
.card-header h2 { font-size: 0.9375rem; font-weight: 700; color: #0f172a; margin-bottom: 0.2rem; }
.hint { font-size: 0.8125rem; color: #94a3b8; }

.radios     { display: flex; gap: 1.5rem; flex-wrap: wrap; }
.radios-col { flex-direction: column; gap: 0.75rem; }
.radio-item { display: flex; align-items: center; gap: 0.625rem; font-size: 0.9rem; color: #374151; cursor: pointer; user-select: none; }
.radio-item input[type="radio"] { display: none; }
.radio-circle { width: 18px; height: 18px; border: 1.5px solid #cbd5e1; border-radius: 50%; flex-shrink: 0; transition: all 0.15s; background: white; }
.radio-item input:checked + .radio-circle { border-color: #0ea5e9; border-width: 5px; }

.sub-fields { margin-top: 1.125rem; padding-top: 1.125rem; border-top: 1px solid #f1f5f9; display: flex; flex-direction: column; gap: 1rem; }
.field-sm { max-width: 180px; }
.field label { display: block; font-size: 0.8125rem; font-weight: 600; color: #374151; margin-bottom: 0.4rem; }
.field input { width: 100%; padding: 0.6rem 0.75rem; border: 1.5px solid #e2e8f0; border-radius: 9px; font-size: 0.9rem; font-family: inherit; outline: none; transition: border-color 0.15s; color: #0f172a; }
.field input:focus { border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(14,165,233,0.1); }

.select-input {
  width: 100%; padding: 0.6rem 0.75rem; border: 1.5px solid #e2e8f0; border-radius: 9px;
  font-size: 0.9rem; font-family: inherit; outline: none; background: white; color: #0f172a;
  cursor: pointer; appearance: none; transition: border-color 0.15s;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 0.75rem center; padding-right: 2.25rem;
}
.select-input:focus { border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(14,165,233,0.1); }

.checks-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.6rem; }
.check-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; color: #374151; cursor: pointer; user-select: none; }
.check-item input[type="checkbox"] { display: none; }
.check-box { width: 17px; height: 17px; border: 1.5px solid #cbd5e1; border-radius: 4px; flex-shrink: 0; transition: all 0.15s; position: relative; background: white; }
.check-item input:checked + .check-box { background: #0ea5e9; border-color: #0ea5e9; }
.check-item input:checked + .check-box::after { content: ''; position: absolute; left: 3px; top: 1px; width: 6px; height: 9px; border: 2px solid white; border-top: none; border-left: none; transform: rotate(45deg); }

.tags-input { display: flex; flex-wrap: wrap; gap: 0.4rem; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 0.5rem 0.625rem; background: #fafafa; transition: all 0.15s; }
.tags-input:focus-within { border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(14,165,233,0.1); background: white; }
.tags-input input { border: none; background: transparent; padding: 0.2rem 0.25rem; flex: 1; min-width: 120px; font-size: 0.9rem; font-family: inherit; outline: none; color: #0f172a; }
.tag { display: flex; align-items: center; gap: 0.25rem; background: #e0f2fe; color: #0284c7; font-size: 0.8rem; font-weight: 600; padding: 0.18rem 0.45rem 0.18rem 0.65rem; border-radius: 999px; }
.tag button { background: none; border: none; color: #7dd3fc; cursor: pointer; font-size: 1rem; padding: 0; line-height: 1; transition: color 0.15s; }
.tag button:hover { color: #0284c7; }

.actions { display: flex; align-items: center; gap: 1rem; }
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

@media (max-width: 640px) {
  .checks-grid-3 { grid-template-columns: 1fr 1fr; }
  .content { padding: 1.5rem 1rem; }
}
</style>
