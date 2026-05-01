<template>
  <NuxtLayout name="dashboard">
    <div class="content">

      <div class="header">
        <div>
          <h1>Estadísticas</h1>
          <p class="subtitle">Panorama del mercado de fondos y licitaciones</p>
        </div>
        <div class="header-meta" v-if="!loading">
          Actualizado {{ fechaActualizacion }}
        </div>
      </div>

      <!-- Skeleton -->
      <template v-if="loading">
        <div class="stats-row">
          <div v-for="i in 4" :key="i" class="stat-card sk-card">
            <div class="sk-block" style="height:32px;width:60%;margin-bottom:0.4rem;border-radius:6px"></div>
            <div class="sk-block" style="height:12px;width:80%;border-radius:6px"></div>
          </div>
        </div>
        <div class="grid-2">
          <div v-for="i in 4" :key="i" class="section sk-card" style="height:220px">
            <div class="sk-block" style="height:14px;width:40%;margin-bottom:1.25rem;border-radius:6px"></div>
            <div v-for="j in 5" :key="j" class="sk-block" style="height:28px;margin-bottom:0.5rem;border-radius:6px"></div>
          </div>
        </div>
      </template>

      <template v-else>

        <!-- KPIs -->
        <div class="stats-row">
          <div class="stat-card">
            <span class="stat-num">{{ kpi.fondosAbiertos }}</span>
            <span class="stat-label">Fondos abiertos</span>
          </div>
          <div class="stat-card accent-blue">
            <span class="stat-num">{{ kpi.licitacionesAbiertas }}</span>
            <span class="stat-label">Licitaciones abiertas</span>
          </div>
          <div class="stat-card accent-green">
            <span class="stat-num">{{ kpi.cierranEstaSemana }}</span>
            <span class="stat-label">Cierran esta semana</span>
          </div>
          <div class="stat-card accent-purple">
            <span class="stat-num">{{ kpi.organizadores }}</span>
            <span class="stat-label">Organizadores activos</span>
          </div>
        </div>

        <div class="grid-2">

          <!-- Por fuente -->
          <div class="section">
            <h2>Fondos abiertos por fuente</h2>
            <div class="bar-list">
              <div v-for="item in stats.porFuente" :key="item.label" class="bar-row">
                <span class="bar-label">{{ item.label }}</span>
                <div class="bar-track">
                  <div class="bar-fill" :style="{ width: pct(item.count, stats.porFuente[0].count) + '%' }"></div>
                </div>
                <span class="bar-count">{{ item.count }}</span>
              </div>
            </div>
          </div>

          <!-- Por monto -->
          <div class="section">
            <h2>Distribución por monto</h2>
            <div class="bar-list">
              <div v-for="item in stats.porMonto" :key="item.label" class="bar-row">
                <span class="bar-label">{{ item.label }}</span>
                <div class="bar-track">
                  <div class="bar-fill bar-fill-green" :style="{ width: pct(item.count, stats.porMonto[0]?.count ?? 1) + '%' }"></div>
                </div>
                <span class="bar-count">{{ item.count }}</span>
              </div>
            </div>
          </div>

          <!-- Top organizadores -->
          <div class="section">
            <h2>Top organizadores activos</h2>
            <div class="rank-list">
              <div v-for="(item, i) in stats.topOrganizadores" :key="item.label" class="rank-row">
                <span class="rank-pos">{{ i + 1 }}</span>
                <span class="rank-label">{{ item.label }}</span>
                <span class="rank-count">{{ item.count }} fondo{{ item.count !== 1 ? 's' : '' }}</span>
              </div>
            </div>
          </div>

          <!-- Por foco -->
          <div class="section">
            <h2>Áreas de foco más frecuentes</h2>
            <div class="foco-cloud">
              <span
                v-for="item in stats.porFoco"
                :key="item.label"
                class="foco-chip"
                :style="{ fontSize: focoSize(item.count) + 'rem' }"
              >
                {{ item.label }}
                <span class="foco-count">{{ item.count }}</span>
              </span>
            </div>
          </div>

          <!-- Actividad semanal -->
          <div class="section full-width">
            <h2>Fondos agregados por semana</h2>
            <div class="timeline-bars">
              <div v-for="(sem, i) in stats.porSemana" :key="i" class="timeline-col">
                <div class="timeline-bar-wrap">
                  <div
                    class="timeline-bar"
                    :style="{ height: pct(sem.count, maxSemana) + '%' }"
                    :title="`${sem.count} fondos`"
                  ></div>
                </div>
                <span class="timeline-label">{{ sem.label }}</span>
                <span class="timeline-count">{{ sem.count }}</span>
              </div>
            </div>
          </div>

        </div>
      </template>

    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: false })

const supabase = useSupabaseClient()
const loading  = ref(true)

interface StatItem { label: string; count: number }

const kpi = ref({
  fondosAbiertos:       0,
  licitacionesAbiertas: 0,
  cierranEstaSemana:    0,
  organizadores:        0,
})

const stats = ref({
  porFuente:       [] as StatItem[],
  porMonto:        [] as StatItem[],
  topOrganizadores:[] as StatItem[],
  porFoco:         [] as StatItem[],
  porSemana:       [] as { label: string; count: number }[],
})

const fechaActualizacion = computed(() =>
  new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
)

const maxSemana = computed(() =>
  Math.max(1, ...stats.value.porSemana.map(s => s.count))
)

function pct(val: number, max: number) {
  if (!max) return 0
  return Math.max(4, Math.round((val / max) * 100))
}

function focoSize(count: number): number {
  const min = 0.72; const max = 1.05
  const maxCount = stats.value.porFoco[0]?.count ?? 1
  return min + ((count / maxCount) * (max - min))
}

const FUENTE_LABELS: Record<string, string> = {
  corfo: 'CORFO', sercotec: 'SERCOTEC', anid: 'ANID',
  mercadopublico: 'Mercado Público', fondos_gob: 'Fondos.gob.cl',
}
const MONTO_LABELS: Record<string, string> = {
  hasta_1M: 'Hasta $1M', '1M_10M': '$1M – $10M', '10M_30M': '$10M – $30M',
  '30M_60M': '$30M – $60M', '60M_100M': '$60M – $100M', sobre_100M: 'Más de $100M',
}
const MONTO_ORDER = ['hasta_1M', '1M_10M', '10M_30M', '30M_60M', '60M_100M', 'sobre_100M']

onMounted(async () => {
  const ahora    = new Date()
  const en7dias  = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const hace12semanas = new Date(ahora.getTime() - 84 * 24 * 60 * 60 * 1000).toISOString()

  // Carga en paralelo
  const [
    { data: abiertos },
    { count: cLicit },
    { count: cSemana },
    { data: historico },
  ] = await Promise.all([
    supabase
      .from('convocatorias')
      .select('fuente, tipo, monto_rango, organizador, foco, fecha_cierre_postulacion, fecha_scrapeado')
      .eq('estado', 'abierto'),
    supabase
      .from('convocatorias')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'abierto')
      .eq('fuente', 'mercadopublico'),
    supabase
      .from('convocatorias')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'abierto')
      .lte('fecha_cierre_postulacion', en7dias)
      .gte('fecha_cierre_postulacion', ahora.toISOString()),
    supabase
      .from('convocatorias')
      .select('fecha_scrapeado')
      .gte('fecha_scrapeado', hace12semanas)
      .order('fecha_scrapeado', { ascending: true }),
  ])

  const convs = abiertos ?? []

  // KPIs
  const fondosAbiertos = convs.filter(c => c.fuente !== 'mercadopublico').length
  const orgSet = new Set(convs.map(c => c.organizador).filter(Boolean))

  kpi.value = {
    fondosAbiertos,
    licitacionesAbiertas: cLicit ?? 0,
    cierranEstaSemana:    cSemana ?? 0,
    organizadores:        orgSet.size,
  }

  // Por fuente (solo fondos)
  const fuenteMap: Record<string, number> = {}
  for (const c of convs.filter(c => c.fuente !== 'mercadopublico')) {
    fuenteMap[c.fuente] = (fuenteMap[c.fuente] ?? 0) + 1
  }
  stats.value.porFuente = Object.entries(fuenteMap)
    .map(([key, count]) => ({ label: FUENTE_LABELS[key] ?? key, count }))
    .sort((a, b) => b.count - a.count)

  // Por monto
  const montoMap: Record<string, number> = {}
  for (const c of convs) {
    if (c.monto_rango) montoMap[c.monto_rango] = (montoMap[c.monto_rango] ?? 0) + 1
  }
  stats.value.porMonto = MONTO_ORDER
    .filter(k => montoMap[k])
    .map(k => ({ label: MONTO_LABELS[k], count: montoMap[k] }))
    .sort((a, b) => b.count - a.count)

  // Top organizadores
  const orgMap: Record<string, number> = {}
  for (const c of convs) {
    if (c.organizador) orgMap[c.organizador] = (orgMap[c.organizador] ?? 0) + 1
  }
  stats.value.topOrganizadores = Object.entries(orgMap)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Por foco (desanidar arrays)
  const focoMap: Record<string, number> = {}
  for (const c of convs) {
    for (const f of (c.foco ?? [])) {
      focoMap[f] = (focoMap[f] ?? 0) + 1
    }
  }
  stats.value.porFoco = Object.entries(focoMap)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 24)

  // Actividad por semana (últimas 12 semanas)
  const semanas: Record<string, number> = {}
  for (const c of historico ?? []) {
    const d   = new Date(c.fecha_scrapeado)
    const lun = new Date(d)
    lun.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1))
    const key = lun.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
    semanas[key] = (semanas[key] ?? 0) + 1
  }
  stats.value.porSemana = Object.entries(semanas).map(([label, count]) => ({ label, count }))

  loading.value = false
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.content { flex: 1; padding: 2rem 2.5rem; font-family: 'Inter', sans-serif; }

.header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1.75rem; gap: 1rem; flex-wrap: wrap; }
h1 { font-size: 1.625rem; font-weight: 700; color: #0f172a; letter-spacing: -0.025em; }
.subtitle { font-size: 0.875rem; color: #64748b; margin-top: 0.2rem; }
.header-meta { font-size: 0.75rem; color: #94a3b8; align-self: center; }

/* KPI row */
.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
.stat-card {
  background: white; border: 1px solid #e2e8f0; border-radius: 14px;
  padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 0.25rem;
}
.stat-num { font-size: 2rem; font-weight: 800; color: #0f172a; letter-spacing: -0.04em; line-height: 1; }
.stat-label { font-size: 0.78rem; color: #64748b; font-weight: 500; }
.accent-blue  .stat-num { color: #0ea5e9; }
.accent-green .stat-num { color: #16a34a; }
.accent-purple .stat-num { color: #6366f1; }

/* 2-col grid */
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.full-width { grid-column: 1 / -1; }

.section {
  background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1.5rem;
}
.section h2 {
  font-size: 0.78rem; font-weight: 700; color: #0f172a;
  text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 1.25rem;
}

/* Bar list */
.bar-list { display: flex; flex-direction: column; gap: 0.625rem; }
.bar-row { display: flex; align-items: center; gap: 0.75rem; }
.bar-label { font-size: 0.8rem; color: #475569; font-weight: 500; width: 110px; flex-shrink: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bar-track { flex: 1; height: 8px; background: #f1f5f9; border-radius: 999px; overflow: hidden; }
.bar-fill { height: 100%; background: #0ea5e9; border-radius: 999px; transition: width 0.4s ease; }
.bar-fill-green { background: #22c55e; }
.bar-count { font-size: 0.78rem; font-weight: 700; color: #94a3b8; width: 28px; text-align: right; flex-shrink: 0; }

/* Rank list */
.rank-list { display: flex; flex-direction: column; gap: 0.5rem; }
.rank-row { display: flex; align-items: center; gap: 0.75rem; padding: 0.4rem 0; border-bottom: 1px solid #f8fafc; }
.rank-pos { font-size: 0.72rem; font-weight: 800; color: #cbd5e1; width: 18px; flex-shrink: 0; }
.rank-label { flex: 1; font-size: 0.85rem; color: #334155; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rank-count { font-size: 0.75rem; font-weight: 700; color: #94a3b8; flex-shrink: 0; }

/* Foco cloud */
.foco-cloud { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
.foco-chip {
  display: inline-flex; align-items: center; gap: 0.3rem;
  padding: 0.25rem 0.6rem; border-radius: 999px;
  background: #f8fafc; border: 1px solid #e2e8f0; color: #475569;
  font-weight: 500; transition: all 0.15s; cursor: default;
}
.foco-chip:hover { background: #f0f9ff; border-color: #bae6fd; color: #0ea5e9; }
.foco-count { font-size: 0.65rem; font-weight: 700; color: #94a3b8; }

/* Timeline barras */
.timeline-bars {
  display: flex; gap: 0.5rem; align-items: flex-end;
  height: 160px; padding-bottom: 1.5rem; overflow-x: auto;
}
.timeline-col { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; min-width: 52px; flex: 1; height: 100%; }
.timeline-bar-wrap { flex: 1; width: 100%; display: flex; align-items: flex-end; }
.timeline-bar {
  width: 100%; background: #0ea5e9; border-radius: 6px 6px 0 0;
  min-height: 4px; transition: height 0.4s ease;
}
.timeline-label { font-size: 0.65rem; color: #94a3b8; white-space: nowrap; }
.timeline-count { font-size: 0.7rem; font-weight: 700; color: #64748b; }

/* Skeleton */
@keyframes shimmer { from { background-position: -600px 0; } to { background-position: 600px 0; } }
.sk-card { pointer-events: none; }
.sk-block { background: linear-gradient(90deg, #f1f5f9 25%, #e8edf3 50%, #f1f5f9 75%); background-size: 1200px 100%; animation: shimmer 1.5s infinite; border-radius: 6px; }

@media (max-width: 900px) {
  .stats-row { grid-template-columns: 1fr 1fr; }
  .grid-2 { grid-template-columns: 1fr; }
  .content { padding: 1.5rem 1rem; }
}
@media (max-width: 480px) {
  .stats-row { grid-template-columns: 1fr; }
}
</style>
