<template>
  <NuxtLayout name="dashboard">
    <div class="content">
      <div class="header">
        <div>
          <h1>Calendario de cierres</h1>
          <p class="subtitle">Fechas límite de oportunidades abiertas</p>
        </div>
        <div class="tipo-tabs">
          <button :class="['tab', tipoFiltro === 'fondo' ? 'active' : '']" @click="tipoFiltro = 'fondo'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Fondos
          </button>
          <button :class="['tab', tipoFiltro === 'licitacion' ? 'active' : '']" @click="tipoFiltro = 'licitacion'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Licitaciones
          </button>
        </div>
      </div>

      <div v-if="loading" class="timeline">
        <div v-for="g in 2" :key="g" class="grupo">
          <div class="grupo-header">
            <div class="sk-block" style="width:100px;height:24px;border-radius:999px"></div>
            <div class="sk-block" style="width:70px;height:13px"></div>
          </div>
          <div class="grupo-lista">
            <div v-for="i in 3" :key="i" class="item-row sk-card" style="pointer-events:none">
              <div class="sk-block" style="width:36px;height:50px;flex-shrink:0;border-radius:8px"></div>
              <div style="flex:1;display:flex;flex-direction:column;gap:0.45rem">
                <div style="display:flex;gap:0.4rem">
                  <div class="sk-block" style="width:56px;height:13px"></div>
                  <div class="sk-block" style="width:56px;height:13px"></div>
                </div>
                <div class="sk-block" style="height:15px;width:75%"></div>
                <div class="sk-block" style="height:12px;width:45%"></div>
              </div>
              <div class="sk-block" style="width:38px;height:44px;flex-shrink:0;border-radius:8px"></div>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="grupos.length === 0" class="empty">
        <div class="empty-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        </div>
        <p class="empty-title">Sin fechas próximas</p>
        <p class="empty-desc">No hay oportunidades abiertas con fecha de cierre registrada.</p>
      </div>

      <div v-else class="timeline">
        <div v-for="grupo in grupos" :key="grupo.label" class="grupo">
          <div class="grupo-header">
            <span :class="['grupo-chip', grupo.tipo]">{{ grupo.label }}</span>
            <span class="grupo-count">{{ grupo.items.length }} oportunidad{{ grupo.items.length !== 1 ? 'es' : '' }}</span>
          </div>

          <!-- Bloqueado para plan Free -->
          <div v-if="plan === 'free' && GRUPOS_BLOQUEADOS_FREE.has(grupo.tipo)" class="grupo-locked">
            <div class="locked-items">
              <div v-for="i in Math.min(3, grupo.items.length)" :key="i" class="item-row-ghost"></div>
            </div>
            <div class="locked-overlay">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <span>{{ grupo.items.length }} oportunidad{{ grupo.items.length !== 1 ? 'es' : '' }} · Plan Starter o superior</span>
              <NuxtLink to="/planes" class="btn-unlock">Mejorar plan</NuxtLink>
            </div>
          </div>

          <!-- Normal (free con acceso o cualquier plan de pago) -->
          <template v-else>
            <div class="grupo-lista">
              <NuxtLink
                v-for="item in gruposExpandidos.has(grupo.label) ? grupo.items : grupo.items.slice(0, LIMIT_POR_GRUPO)"
                :key="item.id"
                :to="`/dashboard/oportunidades/${item.id}`"
                class="item-row"
              >
                <div class="item-fecha">
                  <span class="fecha-dia">{{ diaDel(item.fecha_cierre_postulacion) }}</span>
                  <span class="fecha-mes">{{ mesDel(item.fecha_cierre_postulacion) }}</span>
                </div>
                <div class="item-info">
                  <div class="item-top">
                    <img :src="`/sources/${item.fuente}.png`" :alt="fuenteLabel(item.fuente)" class="source-logo" @error="(e) => (e.target as HTMLImageElement).style.display='none'" />
                    <span class="tag-fuente">{{ fuenteLabel(item.fuente) }}</span>
                    <span :class="['tag-tipo', item.tipo]">{{ item.tipo === 'fondo' ? 'Fondo' : 'Licitación' }}</span>
                  </div>
                  <p class="item-titulo">{{ item.titulo }}</p>
                  <p v-if="item.monto_rango" class="item-monto">{{ montoLabel(item.monto_rango) }}</p>
                </div>
                <div class="item-dias" :class="{ urgente: grupo.tipo === 'urgente', hoy: grupo.tipo === 'hoy' }">
                  <span class="dias-num">{{ diasRestantes(item.fecha_cierre_postulacion) }}</span>
                  <span class="dias-label">{{ diasRestantes(item.fecha_cierre_postulacion) === '1' ? 'día' : 'días' }}</span>
                </div>
              </NuxtLink>
            </div>

            <button
              v-if="grupo.items.length > LIMIT_POR_GRUPO"
              class="btn-ver-mas"
              @click="gruposExpandidos.has(grupo.label) ? gruposExpandidos.delete(grupo.label) : gruposExpandidos.add(grupo.label)"
            >
              <template v-if="!gruposExpandidos.has(grupo.label)">
                Ver {{ grupo.items.length - LIMIT_POR_GRUPO }} más en "{{ grupo.label }}"
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </template>
              <template v-else>
                Mostrar menos
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
              </template>
            </button>
          </template>
        </div>
      </div>
    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: false })

const supabase = useSupabaseClient()
const { plan, load: loadPlan } = usePlan()
const items = ref<any[]>([])
const loading = ref(true)
const tipoFiltro = ref<'fondo' | 'licitacion'>('fondo')
watch(tipoFiltro, () => gruposExpandidos.value.clear())

const GRUPOS_BLOQUEADOS_FREE = new Set(['proximo', 'lejano', 'futuro'])

const LIMIT_POR_GRUPO = 10
const gruposExpandidos = ref<Set<string>>(new Set())

const grupos = computed(() => {
  const filtered = items.value.filter(i => i.tipo === tipoFiltro.value)
  if (!filtered.length) return []

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const en7  = new Date(hoy); en7.setDate(hoy.getDate() + 7)
  const en30 = new Date(hoy); en30.setDate(hoy.getDate() + 30)
  const en90 = new Date(hoy); en90.setDate(hoy.getDate() + 90)

  const grupos: { label: string; tipo: string; items: any[] }[] = [
    { label: 'Hoy',            tipo: 'hoy',      items: [] },
    { label: 'Esta semana',    tipo: 'urgente',   items: [] },
    { label: 'Este mes',       tipo: 'proximo',   items: [] },
    { label: 'Próximos 3 meses', tipo: 'lejano',  items: [] },
    { label: 'Más adelante',   tipo: 'futuro',    items: [] },
  ]

  for (const item of filtered) {
    const fecha = new Date(item.fecha_cierre_postulacion); fecha.setHours(0, 0, 0, 0)
    if (fecha.getTime() === hoy.getTime())      grupos[0].items.push(item)
    else if (fecha <= en7)                      grupos[1].items.push(item)
    else if (fecha <= en30)                     grupos[2].items.push(item)
    else if (fecha <= en90)                     grupos[3].items.push(item)
    else                                        grupos[4].items.push(item)
  }

  return grupos.filter(g => g.items.length > 0)
})

onMounted(async () => {
  await loadPlan()
  const hoy = new Date().toISOString().split('T')[0]
  const { data } = await supabase
    .from('convocatorias')
    .select('id, titulo, fuente, tipo, monto_rango, fecha_cierre_postulacion')
    .eq('estado', 'abierto')
    .gte('fecha_cierre_postulacion', hoy)
    .order('fecha_cierre_postulacion', { ascending: true })
  items.value = data ?? []
  loading.value = false
})

function diasRestantes(f: string) {
  const dias = Math.ceil((new Date(f).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (dias <= 0) return '0'
  return String(dias)
}

function diaDel(f: string) {
  return new Date(f).toLocaleDateString('es-CL', { day: '2-digit' })
}

function mesDel(f: string) {
  return new Date(f).toLocaleDateString('es-CL', { month: 'short' }).replace('.', '')
}

function fuenteLabel(f: string) {
  const map: Record<string, string> = { corfo: 'CORFO', sercotec: 'SERCOTEC', anid: 'ANID', mercadopublico: 'Mercado Público', fondos_gob: 'Fondos.gob.cl', incubadoras: 'Incubadoras', fondos_cultura: 'Fondos Cultura' }
  return map[f] ?? f
}

function montoLabel(m: string) {
  const map: Record<string, string> = { hasta_1M: 'Hasta $1M', '1M_10M': '$1M – $10M', '10M_30M': '$10M – $30M', '30M_60M': '$30M – $60M', '60M_100M': '$60M – $100M', sobre_100M: 'Más de $100M' }
  return map[m] ?? m
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.content { flex: 1; padding: 2rem 2.5rem; font-family: 'Inter', sans-serif; }
.header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1.75rem; flex-wrap: wrap; }
h1 { font-size: 1.625rem; font-weight: 700; color: #0f172a; letter-spacing: -0.025em; }
.subtitle { font-size: 0.875rem; color: #64748b; margin-top: 0.2rem; }

.tipo-tabs {
  display: flex; gap: 0.25rem;
  background: #f1f5f9; border-radius: 10px; padding: 0.25rem;
  flex-shrink: 0;
}
.tab {
  display: flex; align-items: center; gap: 0.375rem;
  padding: 0.45rem 1rem; border-radius: 7px; border: none;
  font-size: 0.875rem; font-weight: 500; font-family: inherit;
  color: #64748b; background: none; cursor: pointer;
  transition: all 0.15s; white-space: nowrap;
}
.tab:hover { color: #0f172a; }
.tab.active { background: white; color: #0f172a; font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }

.empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 5rem 2rem; text-align: center; gap: 0.75rem; }
.empty-icon { width: 56px; height: 56px; background: #f1f5f9; border-radius: 14px; display: flex; align-items: center; justify-content: center; margin-bottom: 0.25rem; }
.empty-title { font-size: 1rem; font-weight: 600; color: #0f172a; }
.empty-desc { font-size: 0.875rem; color: #64748b; max-width: 360px; line-height: 1.5; }

.timeline { display: flex; flex-direction: column; gap: 2rem; }

.grupo-header {
  display: flex; align-items: center; gap: 0.75rem;
  margin-bottom: 0.875rem;
}
.grupo-chip {
  font-size: 0.75rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; padding: 0.2rem 0.75rem; border-radius: 999px;
}
.grupo-chip.hoy    { background: #fef2f2; color: #dc2626; }
.grupo-chip.urgente { background: #fef3c7; color: #b45309; }
.grupo-chip.proximo { background: #f0f9ff; color: #0369a1; }
.grupo-chip.lejano  { background: #f0fdf4; color: #15803d; }
.grupo-chip.futuro  { background: #f8fafc; color: #64748b; }

.grupo-count { font-size: 0.8125rem; color: #94a3b8; }

.grupo-lista { display: flex; flex-direction: column; gap: 0.5rem; }

.item-row {
  display: flex; align-items: center; gap: 1rem;
  background: white; border: 1px solid #e2e8f0; border-radius: 12px;
  padding: 1rem 1.25rem; text-decoration: none;
  transition: box-shadow 0.15s, border-color 0.15s;
}
.item-row:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.06); border-color: #cbd5e1; }

.item-fecha {
  display: flex; flex-direction: column; align-items: center;
  min-width: 40px; flex-shrink: 0;
}
.fecha-dia { font-size: 1.375rem; font-weight: 800; color: #0f172a; line-height: 1; }
.fecha-mes { font-size: 0.6875rem; font-weight: 600; color: #94a3b8; text-transform: uppercase; }

.item-info { flex: 1; min-width: 0; }
.source-logo { width: 32px; height: 32px; border-radius: 7px; object-fit: cover; flex-shrink: 0; }
.item-top { display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.3rem; flex-wrap: wrap; }
.tag-fuente { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #0ea5e9; }
.tag-tipo { font-size: 0.7rem; font-weight: 600; padding: 0.15rem 0.5rem; border-radius: 999px; }
.tag-tipo.fondo { background: #f0fdf4; color: #16a34a; }
.tag-tipo.licitacion { background: #eef2ff; color: #4338ca; }

.item-titulo { font-size: 0.9rem; font-weight: 600; color: #0f172a; line-height: 1.35; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.item-monto { font-size: 0.8rem; color: #64748b; margin-top: 0.2rem; }

.item-dias {
  display: flex; flex-direction: column; align-items: center;
  min-width: 48px; flex-shrink: 0;
}
.dias-num { font-size: 1.375rem; font-weight: 800; color: #64748b; line-height: 1; }
.dias-label { font-size: 0.6875rem; color: #94a3b8; font-weight: 600; text-transform: uppercase; }
.item-dias.urgente .dias-num { color: #f59e0b; }
.item-dias.hoy .dias-num { color: #dc2626; }

/* ── Bloqueo plan Free ──────────────────────────────────────── */
.grupo-locked {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
}
.locked-items {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  filter: blur(4px);
  pointer-events: none;
  user-select: none;
}
.item-row-ghost {
  height: 76px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
}
.locked-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  background: rgba(248,250,252,0.75);
  backdrop-filter: blur(2px);
  font-size: 0.875rem;
  font-weight: 500;
  color: #64748b;
  padding: 1rem;
}
.btn-unlock {
  display: inline-flex;
  align-items: center;
  padding: 0.375rem 0.875rem;
  background: #0ea5e9;
  color: white;
  font-size: 0.8125rem;
  font-weight: 600;
  border-radius: 7px;
  text-decoration: none;
  transition: background 0.15s;
  white-space: nowrap;
}
.btn-unlock:hover { background: #0284c7; }

.btn-ver-mas {
  display: flex; align-items: center; gap: 0.4rem;
  margin-top: 0.5rem; padding: 0.5rem 0.75rem;
  background: none; border: 1.5px solid #e2e8f0; border-radius: 8px;
  font-size: 0.8375rem; font-weight: 500; color: #64748b;
  font-family: inherit; cursor: pointer; transition: all 0.15s;
}
.btn-ver-mas:hover { border-color: #0ea5e9; color: #0ea5e9; }

.spinner { width: 28px; height: 28px; border: 3px solid #e2e8f0; border-top-color: #0ea5e9; border-radius: 50%; animation: spin 0.65s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@keyframes shimmer { from { background-position: -600px 0; } to { background-position: 600px 0; } }
.sk-block { background: linear-gradient(90deg, #f1f5f9 25%, #e8edf3 50%, #f1f5f9 75%); background-size: 1200px 100%; animation: shimmer 1.5s infinite; border-radius: 6px; }

@media (max-width: 640px) {
  .content { padding: 1.5rem 1rem; }
  .item-titulo { white-space: normal; }
}
</style>
