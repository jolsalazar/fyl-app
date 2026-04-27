<template>
  <NuxtLayout name="dashboard">
    <div class="content">
      <div class="header">
        <div>
          <h1>Configuración</h1>
          <p class="subtitle">Define qué oportunidades quieres recibir</p>
        </div>
      </div>

      <form class="form" @submit.prevent="guardar">
        <section class="card">
          <div class="card-header">
            <h2>Categorías</h2>
            <p class="hint">¿Qué tipos de fondos o licitaciones te interesan?</p>
          </div>
          <div class="checks">
            <label v-for="cat in categorias" :key="cat.value" class="check-item">
              <input type="checkbox" :value="cat.value" v-model="config.categorias" />
              <span class="check-box"></span>
              {{ cat.label }}
            </label>
          </div>
        </section>

        <section class="card">
          <div class="card-header">
            <h2>Regiones</h2>
            <p class="hint">¿En qué regiones operas?</p>
          </div>
          <div class="checks">
            <label v-for="r in regiones" :key="r.value" class="check-item">
              <input type="checkbox" :value="r.value" v-model="config.regiones" />
              <span class="check-box"></span>
              {{ r.label }}
            </label>
          </div>
        </section>

        <section class="card">
          <div class="card-header">
            <h2>Rango de monto</h2>
            <p class="hint">En CLP. Deja en 0 para sin límite.</p>
          </div>
          <div class="row">
            <div class="field">
              <label>Mínimo ($)</label>
              <input type="number" v-model.number="config.monto_min" min="0" placeholder="0" />
            </div>
            <div class="field">
              <label>Máximo ($)</label>
              <input type="number" v-model.number="config.monto_max" min="0" placeholder="Sin límite" />
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card-header">
            <h2>Palabras clave</h2>
            <p class="hint">Términos relevantes para tu actividad. Presiona Enter para agregar.</p>
          </div>
          <div class="tags-input">
            <span v-for="(tag, i) in config.palabras_clave" :key="i" class="tag">
              {{ tag }}
              <button type="button" @click="removeTag(i)">×</button>
            </span>
            <input
              v-model="tagInput"
              type="text"
              placeholder="ej: tecnología, exportación..."
              @keydown.enter.prevent="addTag"
              @keydown.comma.prevent="addTag"
            />
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

      <!-- Seguridad -->
      <form class="form" style="margin-top:1.25rem;" @submit.prevent="cambiarPassword">
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

const guardando = ref(false)
const mensaje = ref('')
const mensajeError = ref(false)
const tagInput = ref('')

const cambiando = ref(false)
const nuevaPassword = ref('')
const confirmarPassword = ref('')
const mensajePassword = ref('')
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

const config = ref({
  categorias: [] as string[],
  regiones: [] as string[],
  monto_min: 0,
  monto_max: 0,
  palabras_clave: [] as string[],
})

const categorias = [
  { value: 'fondos_concursables', label: 'Fondos Concursables' },
  { value: 'licitaciones', label: 'Licitaciones Públicas' },
  { value: 'subsidios', label: 'Subsidios' },
  { value: 'capital_semilla', label: 'Capital Semilla' },
  { value: 'internacionalizacion', label: 'Internacionalización' },
]

const regiones = [
  { value: 'RM', label: 'Región Metropolitana' },
  { value: 'V', label: 'Valparaíso' },
  { value: 'VIII', label: 'Biobío' },
  { value: 'IX', label: 'La Araucanía' },
  { value: 'nacional', label: 'Nacional (todas las regiones)' },
]

onMounted(async () => {
  const { data: { user } } = await supabase.auth.getUser()
  const { data } = await supabase
    .from('alert_configs')
    .select('*')
    .eq('user_id', user!.id)
    .maybeSingle()
  if (data) {
    config.value = {
      categorias: data.categorias ?? [],
      regiones: data.regiones ?? [],
      monto_min: data.monto_min ?? 0,
      monto_max: data.monto_max ?? 0,
      palabras_clave: data.palabras_clave ?? [],
    }
  }
})

function addTag() {
  const val = tagInput.value.trim().replace(',', '')
  if (val && !config.value.palabras_clave.includes(val)) {
    config.value.palabras_clave.push(val)
  }
  tagInput.value = ''
}

function removeTag(i: number) {
  config.value.palabras_clave.splice(i, 1)
}

async function guardar() {
  guardando.value = true
  mensaje.value = ''
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('alert_configs')
    .upsert({ user_id: user!.id, ...config.value }, { onConflict: 'user_id' })
  mensajeError.value = !!error
  mensaje.value = error ? 'Error al guardar. Intenta de nuevo.' : '✓ Configuración guardada'
  guardando.value = false
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.content {
  flex: 1;
  padding: 2.5rem;
  font-family: 'Inter', sans-serif;
}
.header {
  margin-bottom: 2rem;
}
h1 {
  font-size: 1.625rem;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.025em;
}
.subtitle {
  font-size: 0.9375rem;
  color: #64748b;
  margin-top: 0.2rem;
}
.form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  max-width: 600px;
}
.card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 1.5rem;
}
.card-header {
  margin-bottom: 1.125rem;
}
.card-header h2 {
  font-size: 0.9375rem;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 0.2rem;
}
.hint {
  font-size: 0.8125rem;
  color: #94a3b8;
}
.checks {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}
.check-item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  font-size: 0.9rem;
  color: #374151;
  cursor: pointer;
  user-select: none;
}
.check-item input[type="checkbox"] {
  display: none;
}
.check-box {
  width: 18px; height: 18px;
  border: 1.5px solid #cbd5e1;
  border-radius: 5px;
  flex-shrink: 0;
  transition: all 0.15s;
  position: relative;
  background: white;
}
.check-item input:checked + .check-box {
  background: #0ea5e9;
  border-color: #0ea5e9;
}
.check-item input:checked + .check-box::after {
  content: '';
  position: absolute;
  left: 4px; top: 1px;
  width: 6px; height: 10px;
  border: 2px solid white;
  border-top: none;
  border-left: none;
  transform: rotate(45deg);
}
.row {
  display: flex;
  gap: 1rem;
}
.field { flex: 1; }
.field label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.4rem;
}
.field input {
  width: 100%;
  padding: 0.6rem 0.75rem;
  border: 1.5px solid #e2e8f0;
  border-radius: 9px;
  font-size: 0.9rem;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  color: #0f172a;
}
.field input:focus {
  border-color: #0ea5e9;
  box-shadow: 0 0 0 3px rgba(14,165,233,0.1);
}
.tags-input {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  padding: 0.625rem;
  background: #fafafa;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.tags-input:focus-within {
  border-color: #0ea5e9;
  box-shadow: 0 0 0 3px rgba(14,165,233,0.1);
  background: white;
}
.tags-input input {
  border: none;
  background: transparent;
  padding: 0.2rem 0.25rem;
  flex: 1;
  min-width: 120px;
  font-size: 0.9rem;
  font-family: inherit;
  outline: none;
  color: #0f172a;
}
.tag {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  background: #e0f2fe;
  color: #0284c7;
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.2rem 0.5rem 0.2rem 0.7rem;
  border-radius: 999px;
}
.tag button {
  background: none;
  border: none;
  color: #7dd3fc;
  cursor: pointer;
  font-size: 1.1rem;
  padding: 0;
  line-height: 1;
  transition: color 0.15s;
}
.tag button:hover { color: #0284c7; }
.actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.mensaje {
  font-size: 0.875rem;
  font-weight: 500;
  padding: 0.5rem 0.875rem;
  border-radius: 8px;
}
.mensaje.ok { background: #f0fdf4; color: #16a34a; }
.mensaje.error { background: #fef2f2; color: #dc2626; }
button[type="submit"] {
  padding: 0.7rem 1.75rem;
  background: #0ea5e9;
  color: white;
  font-size: 0.9375rem;
  font-weight: 600;
  font-family: inherit;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  white-space: nowrap;
}
button[type="submit"]:hover:not(:disabled) { background: #0284c7; }
button[type="submit"]:disabled { opacity: 0.6; cursor: not-allowed; }
.spinner {
  width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.65s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
