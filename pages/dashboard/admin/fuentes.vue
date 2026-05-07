<template>
  <NuxtLayout name="dashboard">
    <div class="content">
      <div class="header">
        <div>
          <h1>Fuentes del scraper</h1>
          <p class="subtitle">Estadísticas y control de cada fuente</p>
        </div>
      </div>

      <div class="table-wrap">
        <div v-if="loading" class="loading">Cargando…</div>
        <div v-else-if="loadError" class="error">No se pudieron cargar las fuentes. Intenta recargar la página.</div>
        <template v-else>
          <div class="table-head">
            <span>Fuente</span>
            <span class="col-stat">Total</span>
            <span class="col-stat">Esta semana</span>
            <span class="col-stat">Última actualización</span>
            <span class="col-toggle">Activa</span>
          </div>
          <div v-for="f in fuentes" :key="f.fuente" class="fuente-row" :class="{ inactiva: !f.activo }">
            <div class="fuente-info">
              <span class="fuente-nombre">{{ f.nombre }}</span>
              <span class="fuente-key">{{ f.fuente }}</span>
            </div>
            <span class="col-stat stat-val">{{ stats[f.fuente]?.total ?? '—' }}</span>
            <span class="col-stat stat-val">
              <span v-if="stats[f.fuente]?.nuevas_semana" class="nuevas-chip">+{{ stats[f.fuente].nuevas_semana }}</span>
              <span v-else class="stat-muted">0</span>
            </span>
            <span class="col-stat stat-val stat-muted">{{ formatFecha(stats[f.fuente]?.ultima_actualizacion) }}</span>
            <div class="col-toggle">
              <span v-if="saving === f.fuente" class="saving-text">…</span>
              <label class="toggle" :title="f.activo ? 'Desactivar' : 'Activar'">
                <input type="checkbox" :checked="f.activo" :disabled="saving === f.fuente" @change="toggle(f)" />
                <span class="slider"></span>
              </label>
            </div>
          </div>
        </template>
      </div>

    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'], layout: false })

const supabase = useSupabaseClient()

interface Fuente { fuente: string; nombre: string; activo: boolean; updated_at: string }
interface StatRow { fuente: string; total: number; nuevas_semana: number; ultima_actualizacion: string }

const { show } = useToast()

const fuentes = ref<Fuente[]>([])
const stats = ref<Record<string, StatRow>>({})
const loading = ref(true)
const loadError = ref(false)
const saving = ref('')

onMounted(async () => {
  const [{ data: cfg, error: e1 }, { data: st, error: e2 }] = await Promise.all([
    supabase.from('scraper_config').select('fuente, nombre, activo, updated_at').order('nombre'),
    supabase.rpc('admin_scraper_stats'),
  ])
  if (e1) {
    loadError.value = true
  } else {
    fuentes.value = cfg ?? []
  }
  if (!e2) {
    stats.value = Object.fromEntries((st ?? []).map((r: StatRow) => [r.fuente, r]))
  }
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
    show('No se pudo guardar el cambio', 'error')
  } else {
    f.activo = newVal
    show('Guardado', 'ok')
  }
  saving.value = ''
}

)
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.content { flex: 1; padding: 2rem 2.5rem; font-family: 'Inter', sans-serif; }
.header { margin-bottom: 1.75rem; }
h1 { font-size: 1.625rem; font-weight: 700; color: #0f172a; letter-spacing: -0.025em; }
.subtitle { font-size: 0.875rem; color: #64748b; margin-top: 0.2rem; }

.table-wrap { background: white; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }

.table-head {
  display: grid;
  grid-template-columns: 1fr 80px 110px 180px 70px;
  padding: 0.625rem 1.25rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  font-size: 0.75rem;
  font-weight: 700;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  gap: 0.5rem;
}

.fuente-row {
  display: grid;
  grid-template-columns: 1fr 80px 110px 180px 70px;
  align-items: center;
  padding: 0.875rem 1.25rem;
  border-bottom: 1px solid #f1f5f9;
  gap: 0.5rem;
  transition: background 0.15s;
}
.fuente-row:last-child { border-bottom: none; }
.fuente-row:hover { background: #f8fafc; }
.fuente-row.inactiva { opacity: 0.5; }

.fuente-info { display: flex; flex-direction: column; gap: 0.2rem; }
.fuente-nombre { font-size: 0.9375rem; font-weight: 600; color: #0f172a; }
.fuente-key { font-size: 0.75rem; color: #94a3b8; font-family: monospace; }

.col-stat { display: flex; align-items: center; }
.col-toggle { display: flex; align-items: center; gap: 0.5rem; }
.stat-val { font-size: 0.9rem; font-weight: 600; color: #0f172a; }
.stat-muted { color: #94a3b8 !important; font-weight: 400 !important; font-size: 0.8125rem !important; }

.nuevas-chip {
  background: #f0fdf4; color: #16a34a;
  font-size: 0.75rem; font-weight: 700;
  padding: 0.15rem 0.5rem; border-radius: 6px;
}

.saving-text { font-size: 0.75rem; color: #94a3b8; }

.toggle { position: relative; display: inline-flex; width: 44px; height: 24px; cursor: pointer; }
.toggle input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; inset: 0; background: #cbd5e1; border-radius: 999px; transition: background 0.2s; }
.slider::before { content: ''; position: absolute; width: 18px; height: 18px; border-radius: 50%; background: white; left: 3px; top: 3px; transition: transform 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,.2); }
.toggle input:checked + .slider { background: #0ea5e9; }
.toggle input:checked + .slider::before { transform: translateX(20px); }
.toggle input:disabled + .slider { opacity: 0.5; cursor: not-allowed; }

.loading, .error { padding: 3rem; text-align: center; color: #64748b; font-size: 0.9rem; }
.error { color: #ef4444; }
.saved-msg { margin-top: 1rem; font-size: 0.875rem; color: #16a34a; font-weight: 500; }
</style>
