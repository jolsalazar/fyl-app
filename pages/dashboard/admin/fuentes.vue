<template>
  <NuxtLayout name="dashboard">
    <div class="content">
      <div class="header">
        <div>
          <h1>Fuentes del scraper</h1>
          <p class="subtitle">Activa o desactiva las fuentes de convocatorias</p>
        </div>
      </div>

      <div class="table-wrap">
        <div v-if="loading" class="loading">Cargando fuentes…</div>
        <div v-else-if="error" class="error">{{ error }}</div>
        <template v-else>
          <div v-for="f in fuentes" :key="f.fuente" class="fuente-row">
            <div class="fuente-info">
              <span class="fuente-nombre">{{ f.nombre }}</span>
              <span class="fuente-key">{{ f.fuente }}</span>
            </div>
            <div class="fuente-right">
              <span v-if="saving === f.fuente" class="saving-text">Guardando…</span>
              <label class="toggle" :title="f.activo ? 'Desactivar' : 'Activar'">
                <input
                  type="checkbox"
                  :checked="f.activo"
                  :disabled="saving === f.fuente"
                  @change="toggle(f)"
                />
                <span class="slider"></span>
              </label>
            </div>
          </div>
        </template>
      </div>

      <p v-if="lastSaved" class="saved-msg">Guardado correctamente</p>
    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'], layout: false })

const supabase = useSupabaseClient()

interface Fuente {
  fuente: string
  nombre: string
  activo: boolean
  updated_at: string
}

const fuentes = ref<Fuente[]>([])
const loading = ref(true)
const error = ref('')
const saving = ref('')
const lastSaved = ref(false)

onMounted(async () => {
  const { data, error: err } = await supabase
    .from('scraper_config')
    .select('fuente, nombre, activo, updated_at')
    .order('nombre')
  if (err) { error.value = err.message }
  else { fuentes.value = data ?? [] }
  loading.value = false
})

async function toggle(f: Fuente) {
  saving.value = f.fuente
  const newVal = !f.activo
  const { error: err } = await supabase
    .from('scraper_config')
    .update({ activo: newVal, updated_at: new Date().toISOString() })
    .eq('fuente', f.fuente)
  if (err) {
    error.value = err.message
  } else {
    f.activo = newVal
    lastSaved.value = true
    setTimeout(() => { lastSaved.value = false }, 2500)
  }
  saving.value = ''
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.content { flex: 1; padding: 2rem 2.5rem; font-family: 'Inter', sans-serif; }

.header { margin-bottom: 1.75rem; }
h1 { font-size: 1.625rem; font-weight: 700; color: #0f172a; letter-spacing: -0.025em; }
.subtitle { font-size: 0.875rem; color: #64748b; margin-top: 0.2rem; }

.table-wrap {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  max-width: 600px;
}

.fuente-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #f1f5f9;
  gap: 1rem;
}
.fuente-row:last-child { border-bottom: none; }

.fuente-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.fuente-nombre { font-size: 0.9375rem; font-weight: 600; color: #0f172a; }
.fuente-key    { font-size: 0.75rem; color: #94a3b8; font-family: monospace; }

.fuente-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}

.saving-text { font-size: 0.75rem; color: #94a3b8; }

/* Toggle switch */
.toggle {
  position: relative;
  display: inline-flex;
  width: 44px;
  height: 24px;
  cursor: pointer;
}

.toggle input { opacity: 0; width: 0; height: 0; }

.slider {
  position: absolute;
  inset: 0;
  background: #cbd5e1;
  border-radius: 999px;
  transition: background 0.2s;
}

.slider::before {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: white;
  left: 3px;
  top: 3px;
  transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0,0,0,.2);
}

.toggle input:checked + .slider { background: #0ea5e9; }
.toggle input:checked + .slider::before { transform: translateX(20px); }
.toggle input:disabled + .slider { opacity: 0.5; cursor: not-allowed; }

.loading, .error {
  padding: 3rem;
  text-align: center;
  color: #64748b;
  font-size: 0.9rem;
}
.error { color: #ef4444; }

.saved-msg {
  margin-top: 1rem;
  font-size: 0.875rem;
  color: #16a34a;
  font-weight: 500;
}
</style>
