<template>
  <NuxtLayout name="dashboard">
    <div class="content">
      <div class="header">
        <div>
          <h1>Configuración</h1>
          <p class="subtitle">Define tu perfil y los criterios para recibir alertas</p>
        </div>
      </div>

      <!-- ── PERFIL POSTULANTE ─────────────────────────────────── -->
      <div class="section-heading">
        <h2 class="section-title">Perfil Postulante</h2>
        <p class="section-desc">Cuéntanos quién eres y en qué etapa está tu proyecto para encontrar los fondos que realmente calzan contigo.</p>
      </div>

      <form class="form" @submit.prevent="guardarPerfil">

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
                  <option v-for="a in antiguedades" :key="a.value" :value="a.value">{{ a.label }}</option>
                </select>
              </div>
            </div>
          </template>
        </section>

        <section class="card">
          <div class="card-header">
            <h2>Estado del proyecto</h2>
          </div>
          <div class="radios radios-col">
            <label v-for="e in estadosProyecto" :key="e.value" class="radio-item">
              <input type="radio" :value="e.value" v-model="perfil.estado_proyecto" />
              <span class="radio-circle"></span>
              {{ e.label }}
            </label>
          </div>
        </section>

        <section class="card">
          <div class="card-header">
            <h2>Foco del proyecto</h2>
            <p class="hint">Selecciona los focos que mejor describen tu proyecto. Selección múltiple.</p>
          </div>
          <div class="checks checks-grid-3">
            <label v-for="f in focosProyecto" :key="f" class="check-item">
              <input type="checkbox" :value="f" v-model="perfil.foco_proyecto" />
              <span class="check-box"></span>
              {{ f }}
            </label>
          </div>
        </section>

        <section class="card">
          <div class="card-header">
            <h2>Palabras clave del proyecto</h2>
            <p class="hint">Palabras que describen tu proyecto. Presiona Enter para agregar.</p>
          </div>
          <div class="tags-input">
            <span v-for="(tag, i) in perfil.palabras_clave" :key="i" class="tag">
              {{ tag }}
              <button type="button" @click="removePerfilTag(i)">×</button>
            </span>
            <input
              v-model="perfilTagInput"
              type="text"
              placeholder="ej: reciclaje, software, exportación…"
              @keydown.enter.prevent="addPerfilTag"
              @keydown.comma.prevent="addPerfilTag"
            />
          </div>
        </section>

        <section class="card">
          <div class="card-header">
            <h2>Tipo de concurso de interés</h2>
          </div>
          <div class="field">
            <label>Alcance</label>
            <div class="checks" style="margin-top:0.625rem">
              <label v-for="a in alcances" :key="a.value" class="check-item">
                <input type="checkbox" :value="a.value" v-model="perfil.alcance_interes" />
                <span class="check-box"></span>
                {{ a.label }}
              </label>
            </div>
          </div>
          <div class="field" style="margin-top:1.25rem">
            <label>Monto mínimo del concurso</label>
            <select v-model="perfil.monto_minimo" class="select-input" style="margin-top:0.4rem">
              <option value="">Sin límite mínimo</option>
              <option v-for="m in montos" :key="m.value" :value="m.value">{{ m.label }}</option>
            </select>
          </div>
        </section>

        <div class="actions">
          <div v-if="mensajePerfil" :class="['mensaje', mensajePerfilError ? 'error' : 'ok']">
            {{ mensajePerfil }}
          </div>
          <button type="submit" :disabled="guardandoPerfil">
            <span v-if="guardandoPerfil" class="spinner"></span>
            {{ guardandoPerfil ? 'Guardando...' : 'Guardar perfil' }}
          </button>
        </div>
      </form>

      <!-- ── FILTROS DE ALERTA ──────────────────────────────────── -->
      <div class="section-heading" style="margin-top:2.5rem">
        <h2 class="section-title">Filtros de alerta</h2>
        <p class="section-desc">Criterios adicionales para afinar qué oportunidades quieres ver.</p>
      </div>

      <form class="form" @submit.prevent="guardar">

        <section class="card">
          <div class="card-header">
            <h2>Palabras clave</h2>
            <p class="hint">Busca en el título de las convocatorias. Presiona Enter para agregar.</p>
          </div>
          <div class="tags-input">
            <span v-for="(tag, i) in config.palabras_clave" :key="i" class="tag">
              {{ tag }}
              <button type="button" @click="removeTag(i)">×</button>
            </span>
            <input
              v-model="tagInput"
              type="text"
              placeholder="ej: tecnología, exportación, innovación…"
              @keydown.enter.prevent="addTag"
              @keydown.comma.prevent="addTag"
            />
          </div>
        </section>

        <section class="card">
          <div class="card-header">
            <h2>Tipo de oportunidad</h2>
            <p class="hint">Deja en blanco para recibir ambos tipos.</p>
          </div>
          <div class="checks">
            <label class="check-item">
              <input type="checkbox" value="fondo" v-model="config.tipos" />
              <span class="check-box"></span>
              Fondos concursables
            </label>
            <label class="check-item">
              <input type="checkbox" value="licitacion" v-model="config.tipos" />
              <span class="check-box"></span>
              Licitaciones públicas
            </label>
          </div>
        </section>

        <section class="card">
          <div class="card-header">
            <h2>Fuentes</h2>
            <p class="hint">¿De qué organismos quieres recibir alertas?</p>
          </div>
          <div class="checks">
            <label v-for="f in fuentes" :key="f.value" class="check-item">
              <input type="checkbox" :value="f.value" v-model="config.fuentes" />
              <span class="check-box"></span>
              {{ f.label }}
            </label>
          </div>
        </section>

        <section class="card">
          <div class="card-header">
            <h2>Rango de monto</h2>
            <p class="hint">Selecciona los rangos que te interesan. Deja en blanco para cualquier monto.</p>
          </div>
          <div class="checks checks-grid">
            <label v-for="m in montos" :key="m.value" class="check-item">
              <input type="checkbox" :value="m.value" v-model="config.monto_rangos" />
              <span class="check-box"></span>
              {{ m.label }}
            </label>
          </div>
        </section>

        <div class="actions">
          <div v-if="mensaje" :class="['mensaje', mensajeError ? 'error' : 'ok']">
            {{ mensaje }}
          </div>
          <button type="submit" :disabled="guardando">
            <span v-if="guardando" class="spinner"></span>
            {{ guardando ? 'Guardando...' : 'Guardar configuración' }}
          </button>
        </div>
      </form>

      <!-- ── SEGURIDAD ──────────────────────────────────────────── -->
      <form class="form" style="margin-top:2.5rem;" @submit.prevent="cambiarPassword">
        <section class="card">
          <div class="card-header">
            <h2>Seguridad</h2>
            <p class="hint">Cambia tu contraseña de acceso.</p>
          </div>
          <div class="field">
            <label>Nueva contraseña</label>
            <input v-model="nuevaPassword" type="password" placeholder="Mínimo 8 caracteres" minlength="8" :disabled="cambiando" />
          </div>
          <div class="field" style="margin-top:1rem;">
            <label>Confirmar nueva contraseña</label>
            <input v-model="confirmarPassword" type="password" placeholder="Repite la contraseña" :disabled="cambiando" />
          </div>
          <div v-if="mensajePassword" :class="['mensaje', mensajePasswordError ? 'error' : 'ok']" style="margin-top:1rem;">
            {{ mensajePassword }}
          </div>
        </section>
        <div class="actions">
          <button type="submit" :disabled="cambiando || !nuevaPassword">
            <span v-if="cambiando" class="spinner"></span>
            {{ cambiando ? 'Guardando...' : 'Cambiar contraseña' }}
          </button>
        </div>
      </form>

    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: false })

const supabase = useSupabaseClient()

// ── Alert config ────────────────────────────────────────────────
const guardando   = ref(false)
const mensaje     = ref('')
const mensajeError = ref(false)
const tagInput    = ref('')

const config = ref({
  palabras_clave: [] as string[],
  tipos:          [] as string[],
  fuentes:        [] as string[],
  monto_rangos:   [] as string[],
})

const fuentes = [
  { value: 'corfo',          label: 'CORFO' },
  { value: 'sercotec',       label: 'SERCOTEC' },
  { value: 'anid',           label: 'ANID' },
  { value: 'mercadopublico', label: 'Mercado Público' },
  { value: 'fondos_gob',     label: 'Fondos.gob.cl' },
]

const montos = [
  { value: 'hasta_1M',   label: 'Hasta $1M' },
  { value: '1M_10M',     label: '$1M – $10M' },
  { value: '10M_30M',    label: '$10M – $30M' },
  { value: '30M_60M',    label: '$30M – $60M' },
  { value: '60M_100M',   label: '$60M – $100M' },
  { value: 'sobre_100M', label: 'Más de $100M' },
]

function addTag() {
  const val = tagInput.value.trim().replace(',', '')
  if (val && !config.value.palabras_clave.includes(val))
    config.value.palabras_clave.push(val)
  tagInput.value = ''
}
function removeTag(i: number) {
  config.value.palabras_clave.splice(i, 1)
}

async function guardar() {
  guardando.value = true
  mensaje.value   = ''
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('alert_configs')
    .upsert({
      user_id:        user!.id,
      palabras_clave: config.value.palabras_clave,
      tipos:          config.value.tipos,
      fuentes:        config.value.fuentes,
      monto_rangos:   config.value.monto_rangos,
      updated_at:     new Date().toISOString(),
    }, { onConflict: 'user_id' })
  mensajeError.value = !!error
  mensaje.value = error ? 'Error al guardar. Intenta de nuevo.' : '✓ Configuración guardada'
  guardando.value = false
}

// ── Perfil postulante ────────────────────────────────────────────
const guardandoPerfil   = ref(false)
const mensajePerfil     = ref('')
const mensajePerfilError = ref(false)
const perfilTagInput    = ref('')

const perfil = ref({
  tipo_persona:        null as string | null,
  subtipo_natural:     null as string | null,
  edad:                null as number | null,
  antiguedad_empresa:  null as string | null,
  estado_proyecto:     null as string | null,
  foco_proyecto:       [] as string[],
  palabras_clave:      [] as string[],
  alcance_interes:     [] as string[],
  monto_minimo:        '' as string,
})

const estadosProyecto = [
  { value: 'solo_idea',     label: 'Solo idea' },
  { value: 'maqueta',       label: 'Maqueta' },
  { value: 'prototipo',     label: 'Prototipo funcional' },
  { value: 'marcha_blanca', label: 'Marcha blanca con ventas' },
  { value: 'crecimiento',   label: 'Buscando crecer y expandirme' },
]

const focosProyecto = [
  'Agroindustrias', 'Banca y Fintech', 'Climatech', 'Descarbonización',
  'Digitalización', 'Educación', 'Economía Verde', 'I+D+i',
  'Industrial', 'Innovación Social', 'Mujeres', 'Multisectorial',
  'Recursos Forestales', 'Recursos Hídricos', 'Tech',
]

const antiguedades = [
  { value: 'menos_1', label: 'Menos de 1 año' },
  { value: '1_3',     label: '1 a 3 años' },
  { value: '3_5',     label: '3 a 5 años' },
  { value: 'mas_5',   label: 'Más de 5 años' },
]

const alcances = [
  { value: 'regional',       label: 'Regional' },
  { value: 'nacional',       label: 'Nacional' },
  { value: 'internacional',  label: 'Internacional' },
]

function addPerfilTag() {
  const val = perfilTagInput.value.trim().replace(',', '')
  if (val && !perfil.value.palabras_clave.includes(val))
    perfil.value.palabras_clave.push(val)
  perfilTagInput.value = ''
}
function removePerfilTag(i: number) {
  perfil.value.palabras_clave.splice(i, 1)
}

async function guardarPerfil() {
  guardandoPerfil.value  = true
  mensajePerfil.value    = ''
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
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
      alcance_interes:    perfil.value.alcance_interes,
      monto_minimo:       perfil.value.monto_minimo || null,
      updated_at:         new Date().toISOString(),
    }, { onConflict: 'user_id' })
  mensajePerfilError.value = !!error
  mensajePerfil.value = error ? 'Error al guardar. Intenta de nuevo.' : '✓ Perfil guardado'
  guardandoPerfil.value = false
}

// ── Seguridad ────────────────────────────────────────────────────
const cambiando          = ref(false)
const nuevaPassword      = ref('')
const confirmarPassword  = ref('')
const mensajePassword    = ref('')
const mensajePasswordError = ref(false)

async function cambiarPassword() {
  mensajePassword.value = ''
  if (nuevaPassword.value !== confirmarPassword.value) {
    mensajePasswordError.value = true
    mensajePassword.value = 'Las contraseñas no coinciden'
    return
  }
  cambiando.value = true
  const { error } = await supabase.auth.updateUser({ password: nuevaPassword.value })
  mensajePasswordError.value = !!error
  mensajePassword.value = error ? 'Error al cambiar la contraseña. Intenta de nuevo.' : '✓ Contraseña actualizada'
  if (!error) {
    nuevaPassword.value = ''
    confirmarPassword.value = ''
  }
  cambiando.value = false
}

// ── onMounted ────────────────────────────────────────────────────
onMounted(async () => {
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: alertData }, { data: perfilData }] = await Promise.all([
    supabase.from('alert_configs')
      .select('palabras_clave, tipos, fuentes, monto_rangos')
      .eq('user_id', user!.id)
      .maybeSingle(),
    supabase.from('perfil_postulante')
      .select('*')
      .eq('user_id', user!.id)
      .maybeSingle(),
  ])

  if (alertData) {
    config.value = {
      palabras_clave: alertData.palabras_clave ?? [],
      tipos:          alertData.tipos ?? [],
      fuentes:        alertData.fuentes ?? [],
      monto_rangos:   alertData.monto_rangos ?? [],
    }
  }

  if (perfilData) {
    perfil.value = {
      tipo_persona:       perfilData.tipo_persona ?? null,
      subtipo_natural:    perfilData.subtipo_natural ?? null,
      edad:               perfilData.edad ?? null,
      antiguedad_empresa: perfilData.antiguedad_empresa ?? null,
      estado_proyecto:    perfilData.estado_proyecto ?? null,
      foco_proyecto:      perfilData.foco_proyecto ?? [],
      palabras_clave:     perfilData.palabras_clave ?? [],
      alcance_interes:    perfilData.alcance_interes ?? [],
      monto_minimo:       perfilData.monto_minimo ?? '',
    }
  }
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.content { flex: 1; padding: 2.5rem; font-family: 'Inter', sans-serif; }
.header  { margin-bottom: 2rem; }
h1 { font-size: 1.625rem; font-weight: 700; color: #0f172a; letter-spacing: -0.025em; }
.subtitle { font-size: 0.9375rem; color: #64748b; margin-top: 0.2rem; }

/* Section headings */
.section-heading { margin-bottom: 1.25rem; }
.section-title   { font-size: 1.0625rem; font-weight: 700; color: #0f172a; }
.section-desc    { font-size: 0.875rem; color: #64748b; margin-top: 0.2rem; line-height: 1.5; }

.form { display: flex; flex-direction: column; gap: 1.25rem; max-width: 640px; }

.card { background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1.5rem; }
.card-header { margin-bottom: 1.125rem; }
.card-header h2 { font-size: 0.9375rem; font-weight: 700; color: #0f172a; margin-bottom: 0.2rem; }
.hint { font-size: 0.8125rem; color: #94a3b8; }

/* Radio buttons */
.radios { display: flex; gap: 1.5rem; flex-wrap: wrap; }
.radios-col { flex-direction: column; gap: 0.75rem; }
.radio-item {
  display: flex; align-items: center; gap: 0.625rem;
  font-size: 0.9rem; color: #374151; cursor: pointer; user-select: none;
}
.radio-item input[type="radio"] { display: none; }
.radio-circle {
  width: 18px; height: 18px;
  border: 1.5px solid #cbd5e1; border-radius: 50%;
  flex-shrink: 0; transition: all 0.15s;
  position: relative; background: white;
}
.radio-item input:checked + .radio-circle { border-color: #0ea5e9; border-width: 5px; }

/* Sub-fields (conditional content inside card) */
.sub-fields { margin-top: 1.125rem; padding-top: 1.125rem; border-top: 1px solid #f1f5f9; display: flex; flex-direction: column; gap: 1rem; }

/* Checkboxes */
.checks { display: flex; flex-direction: column; gap: 0.625rem; }
.checks-grid  { display: grid; grid-template-columns: 1fr 1fr; gap: 0.625rem; }
.checks-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.625rem; }
.check-item {
  display: flex; align-items: center; gap: 0.625rem;
  font-size: 0.9rem; color: #374151; cursor: pointer; user-select: none;
}
.check-item input[type="checkbox"] { display: none; }
.check-box {
  width: 18px; height: 18px; border: 1.5px solid #cbd5e1;
  border-radius: 5px; flex-shrink: 0; transition: all 0.15s;
  position: relative; background: white;
}
.check-item input:checked + .check-box { background: #0ea5e9; border-color: #0ea5e9; }
.check-item input:checked + .check-box::after {
  content: ''; position: absolute; left: 4px; top: 1px;
  width: 6px; height: 10px; border: 2px solid white;
  border-top: none; border-left: none; transform: rotate(45deg);
}

/* Fields */
.field { flex: 1; }
.field-sm { max-width: 180px; }
.field label {
  display: block; font-size: 0.8125rem; font-weight: 600;
  color: #374151; margin-bottom: 0.4rem;
}
.field input {
  width: 100%; padding: 0.6rem 0.75rem; border: 1.5px solid #e2e8f0;
  border-radius: 9px; font-size: 0.9rem; font-family: inherit;
  outline: none; transition: border-color 0.15s, box-shadow 0.15s; color: #0f172a;
}
.field input:focus { border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(14,165,233,0.1); }

/* Select */
.select-input {
  width: 100%; padding: 0.6rem 0.75rem; border: 1.5px solid #e2e8f0;
  border-radius: 9px; font-size: 0.9rem; font-family: inherit;
  outline: none; background: white; color: #0f172a; cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s; appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 0.75rem center;
  padding-right: 2.25rem;
}
.select-input:focus { border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(14,165,233,0.1); }

/* Tag input */
.tags-input {
  display: flex; flex-wrap: wrap; gap: 0.5rem;
  border: 1.5px solid #e2e8f0; border-radius: 10px;
  padding: 0.625rem; background: #fafafa;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.tags-input:focus-within {
  border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(14,165,233,0.1); background: white;
}
.tags-input input {
  border: none; background: transparent; padding: 0.2rem 0.25rem;
  flex: 1; min-width: 120px; font-size: 0.9rem; font-family: inherit; outline: none; color: #0f172a;
}
.tag {
  display: flex; align-items: center; gap: 0.3rem;
  background: #e0f2fe; color: #0284c7;
  font-size: 0.8rem; font-weight: 600;
  padding: 0.2rem 0.5rem 0.2rem 0.7rem; border-radius: 999px;
}
.tag button { background: none; border: none; color: #7dd3fc; cursor: pointer; font-size: 1.1rem; padding: 0; line-height: 1; transition: color 0.15s; }
.tag button:hover { color: #0284c7; }

/* Actions */
.actions { display: flex; align-items: center; gap: 1rem; }
.mensaje { font-size: 0.875rem; font-weight: 500; padding: 0.5rem 0.875rem; border-radius: 8px; }
.mensaje.ok    { background: #f0fdf4; color: #16a34a; }
.mensaje.error { background: #fef2f2; color: #dc2626; }

button[type="submit"] {
  padding: 0.7rem 1.75rem; background: #0ea5e9; color: white;
  font-size: 0.9375rem; font-weight: 600; font-family: inherit;
  border: none; border-radius: 10px; cursor: pointer;
  transition: background 0.15s;
  display: flex; align-items: center; gap: 0.5rem; white-space: nowrap;
}
button[type="submit"]:hover:not(:disabled) { background: #0284c7; }
button[type="submit"]:disabled { opacity: 0.6; cursor: not-allowed; }

.spinner {
  width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.3); border-top-color: white;
  border-radius: 50%; animation: spin 0.65s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 640px) {
  .checks-grid-3 { grid-template-columns: 1fr 1fr; }
  .content { padding: 1.5rem 1rem; }
}
</style>
