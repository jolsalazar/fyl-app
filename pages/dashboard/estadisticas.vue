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

      <!-- ── UPGRADE GATE (plan free) ───────────────────────────── -->
      <template v-if="plan === 'free'">
        <div class="upgrade-wrap">
          <div class="upgrade-card">
            <div class="upgrade-top">
              <span class="upgrade-plan-actual">Estás en el Plan Free</span>
              <div class="upgrade-icon-wrap">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              </div>
              <h2 class="upgrade-title">Entiende el mercado de fondos y licitaciones</h2>
              <p class="upgrade-desc">El módulo de estadísticas te muestra en tiempo real dónde están las oportunidades, cuánto financiamiento hay disponible y qué sectores son los más activos — para que tomes decisiones informadas sobre dónde enfocar tu energía.</p>
            </div>
            <div class="upgrade-benefits">
              <div class="benefit-item">
                <span class="benefit-check">✓</span>
                <div>
                  <strong>Distribución por fuente y monto</strong>
                  <p>Cuántos fondos tiene cada institución y en qué rangos de financiamiento.</p>
                </div>
              </div>
              <div class="benefit-item">
                <span class="benefit-check">✓</span>
                <div>
                  <strong>Top organizadores activos</strong>
                  <p>Qué entidades están publicando más oportunidades en este momento.</p>
                </div>
              </div>
              <div class="benefit-item">
                <span class="benefit-check">✓</span>
                <div>
                  <strong>Focos más demandados</strong>
                  <p>Qué sectores concentran más fondos abiertos actualmente.</p>
                </div>
              </div>
            </div>
            <div class="upgrade-actions">
              <NuxtLink to="/planes" class="btn-upgrade">
                Mejorar a Plan Starter
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </NuxtLink>
              <NuxtLink to="/planes" class="btn-ver-planes">Ver todos los planes</NuxtLink>
            </div>
          </div>

          <!-- Preview borrosa -->
          <div class="preview-wrap">
            <div class="preview-overlay">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Mejora tu plan para ver las estadísticas
            </div>
            <div class="preview-stats">
              <div class="preview-kpis">
                <div v-for="i in 4" :key="i" class="preview-kpi">
                  <div class="preview-num"></div>
                  <div class="preview-lbl"></div>
                </div>
              </div>
              <div class="preview-charts">
                <div class="preview-chart">
                  <div class="preview-chart-title"></div>
                  <div v-for="(w, i) in [85,60,45,30,20]" :key="i" class="preview-bar-row">
                    <div class="preview-bar-label"></div>
                    <div class="preview-bar" :style="`width:${w}%`"></div>
                  </div>
                </div>
                <div class="preview-chart">
                  <div class="preview-chart-title"></div>
                  <div v-for="(w, i) in [70,55,40,35,15]" :key="i" class="preview-bar-row">
                    <div class="preview-bar-label"></div>
                    <div class="preview-bar" :style="`width:${w}%`"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Skeleton -->
      <template v-else-if="loading">
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

        </div>
      </template>

    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: false })

const supabase = useSupabaseClient()
const loading  = ref(true)
const { plan, load: loadPlan } = usePlan()

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
})

const fechaActualizacion = computed(() =>
  new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
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
  await loadPlan()
  if (plan.value === 'free') { loading.value = false; return }

  const ahora    = new Date()
  const en7dias  = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

  // Carga en paralelo
  const [
    { data: abiertos },
    { count: cLicit },
    { count: cSemana },
  ] = await Promise.all([
    supabase
      .from('convocatorias')
      .select('fuente, tipo, monto_rango, organizador, foco, fecha_cierre_postulacion')
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

/* ── Upgrade gate ───────────────────────────────────────────── */
.upgrade-wrap { display: flex; flex-direction: column; gap: 2rem; max-width: 680px; }
.upgrade-card {
  background: white; border: 1px solid #e2e8f0; border-radius: 20px;
  padding: 2.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}
.upgrade-top { text-align: center; margin-bottom: 2rem; }
.upgrade-plan-actual {
  display: inline-block; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em;
  text-transform: uppercase; color: #64748b; background: #f1f5f9;
  padding: 0.25rem 0.75rem; border-radius: 999px; margin-bottom: 1.25rem;
}
.upgrade-icon-wrap {
  width: 64px; height: 64px; border-radius: 18px;
  background: linear-gradient(135deg, #0ea5e9, #6366f1);
  display: flex; align-items: center; justify-content: center;
  color: white; margin: 0 auto 1.25rem;
}
.upgrade-title { font-size: 1.375rem; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; margin-bottom: 0.75rem; }
.upgrade-desc  { font-size: 0.9375rem; color: #64748b; line-height: 1.65; max-width: 500px; margin: 0 auto; }
.upgrade-benefits { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 2rem; }
.benefit-item { display: flex; align-items: flex-start; gap: 0.875rem; background: #f8fafc; border-radius: 12px; padding: 0.875rem 1rem; }
.benefit-check { width: 22px; height: 22px; min-width: 22px; border-radius: 50%; background: #0ea5e9; color: white; display: flex; align-items: center; justify-content: center; font-size: 0.72rem; font-weight: 700; margin-top: 1px; }
.benefit-item strong { display: block; font-size: 0.9rem; font-weight: 700; color: #0f172a; margin-bottom: 0.2rem; }
.benefit-item p { font-size: 0.8375rem; color: #64748b; margin: 0; line-height: 1.5; }
.upgrade-actions { display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; }
.btn-upgrade {
  display: inline-flex; align-items: center; gap: 0.5rem;
  background: #0ea5e9; color: white; font-size: 0.9375rem; font-weight: 700;
  padding: 0.75rem 1.75rem; border-radius: 11px; text-decoration: none;
  transition: background 0.15s;
}
.btn-upgrade:hover { background: #0284c7; }
.btn-ver-planes {
  display: inline-flex; align-items: center;
  background: white; color: #475569; font-size: 0.9rem; font-weight: 500;
  padding: 0.75rem 1.25rem; border-radius: 11px; text-decoration: none;
  border: 1.5px solid #e2e8f0; transition: border-color 0.15s;
}
.btn-ver-planes:hover { border-color: #0ea5e9; color: #0ea5e9; }

/* Preview borrosa */
.preview-wrap {
  position: relative; border-radius: 16px; overflow: hidden;
  border: 1px solid #e2e8f0; background: white;
}
.preview-overlay {
  position: absolute; inset: 0; z-index: 2;
  background: rgba(248,250,252,0.75); backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
  gap: 0.5rem; font-size: 0.875rem; font-weight: 600; color: #64748b;
}
.preview-stats { padding: 1.5rem; filter: blur(3px); pointer-events: none; }
.preview-kpis { display: grid; grid-template-columns: repeat(4,1fr); gap: 0.75rem; margin-bottom: 1.25rem; }
.preview-kpi { background: #f8fafc; border-radius: 10px; padding: 1rem; }
.preview-num { height: 28px; width: 60%; background: #e2e8f0; border-radius: 6px; margin-bottom: 6px; }
.preview-lbl { height: 10px; width: 80%; background: #f1f5f9; border-radius: 4px; }
.preview-charts { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.preview-chart { background: #f8fafc; border-radius: 10px; padding: 1rem; }
.preview-chart-title { height: 12px; width: 50%; background: #e2e8f0; border-radius: 4px; margin-bottom: 1rem; }
.preview-bar-row { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
.preview-bar-label { width: 60px; height: 10px; background: #e2e8f0; border-radius: 3px; flex-shrink: 0; }
.preview-bar { height: 10px; background: #cbd5e1; border-radius: 3px; }
</style>
