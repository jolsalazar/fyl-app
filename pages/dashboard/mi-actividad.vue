<template>
  <NuxtLayout name="dashboard">
    <div class="content">

      <div class="header">
        <div>
          <h1>Mi actividad</h1>
          <p class="subtitle">Cómo vienen tus postulaciones — guardados, conversión y resultados</p>
        </div>
        <span v-if="!loading && resumenFecha" class="header-meta">{{ resumenFecha }}</span>
      </div>

      <!-- Gate Free -->
      <template v-if="plan === 'free'">
        <div class="upgrade-wrap">
          <div class="upgrade-card">
            <span class="upgrade-plan-actual">Estás en el Plan Free</span>
            <h2 class="upgrade-title">Hacé seguimiento de tu progreso</h2>
            <p class="upgrade-desc">Mirá cuántos fondos guardás, cuántos postulás, y tu tasa real de aprobación — todo en un dashboard personal.</p>
            <NuxtLink to="/planes" class="btn-upgrade">Mejorar a Plan Starter →</NuxtLink>
          </div>
        </div>
      </template>

      <!-- Skeleton -->
      <template v-else-if="loading">
        <div class="kpi-row">
          <div v-for="i in 4" :key="i" class="kpi-card sk-card">
            <div class="sk-block" style="height:32px;width:50%;margin-bottom:0.4rem"></div>
            <div class="sk-block" style="height:12px;width:80%"></div>
          </div>
        </div>
        <div class="grid-2">
          <div v-for="i in 2" :key="i" class="section sk-card" style="height:240px">
            <div class="sk-block" style="height:14px;width:40%;margin-bottom:1.25rem"></div>
            <div v-for="j in 5" :key="j" class="sk-block" style="height:28px;margin-bottom:0.5rem"></div>
          </div>
        </div>
      </template>

      <!-- Empty -->
      <template v-else-if="totalGuardados === 0 && totalPostulaciones === 0">
        <div class="empty">
          <div class="empty-icon">📊</div>
          <p class="empty-title">Aún no hay datos para mostrar</p>
          <p class="empty-desc">Cuando empieces a guardar fondos y a marcarlos como postulados, vas a ver tu progreso acá.</p>
          <NuxtLink to="/dashboard" class="btn-primary">Ver oportunidades</NuxtLink>
        </div>
      </template>

      <!-- Contenido principal -->
      <template v-else>

        <!-- KPIs -->
        <div class="kpi-row">
          <div class="kpi-card">
            <span class="kpi-num">{{ totalGuardados }}</span>
            <span class="kpi-label">Fondos guardados</span>
          </div>
          <div class="kpi-card accent-blue">
            <span class="kpi-num">{{ totalPostulaciones }}</span>
            <span class="kpi-label">En tu pipeline</span>
          </div>
          <div class="kpi-card accent-green">
            <span class="kpi-num">{{ tasaAprobacion ?? '—' }}<small v-if="tasaAprobacion !== null">%</small></span>
            <span class="kpi-label">Tasa de aprobación</span>
            <span v-if="tasaAprobacion === null" class="kpi-hint">aún sin resultados</span>
          </div>
          <div class="kpi-card accent-purple">
            <span class="kpi-num">{{ diasEnPlataforma }}</span>
            <span class="kpi-label">Días en la plataforma</span>
          </div>
        </div>

        <div class="grid-2">

          <!-- Funnel de postulaciones -->
          <div class="section">
            <h2>Estado de tu pipeline</h2>
            <div v-if="totalPostulaciones === 0" class="section-empty">
              <p>Nada en tu pipeline todavía. Marcá un fondo como postulado para empezar.</p>
            </div>
            <div v-else class="funnel">
              <div v-for="e in ESTADOS_FUNNEL" :key="e.value" class="funnel-row">
                <div class="funnel-label">
                  <span class="funnel-emoji">{{ e.emoji }}</span>
                  <span>{{ e.label }}</span>
                </div>
                <div class="funnel-bar-wrap">
                  <div
                    class="funnel-bar"
                    :class="e.value"
                    :style="{ width: barWidth(estadoCount[e.value]) + '%' }"
                  ></div>
                </div>
                <span class="funnel-count">{{ estadoCount[e.value] ?? 0 }}</span>
              </div>
            </div>
          </div>

          <!-- Histórico mensual -->
          <div class="section">
            <h2>Actividad últimos 6 meses</h2>
            <div v-if="!historicoMensual.length" class="section-empty">
              <p>Sin actividad reciente registrada.</p>
            </div>
            <div v-else class="month-bars">
              <div v-for="m in historicoMensual" :key="m.key" class="month-col">
                <div class="month-stack">
                  <div
                    class="month-segment guardados"
                    v-if="m.guardados"
                    :style="{ height: ((m.guardados / maxMes) * 100) + '%' }"
                    :title="`${m.guardados} guardados`"
                  ></div>
                  <div
                    class="month-segment postulaciones"
                    v-if="m.postulaciones"
                    :style="{ height: ((m.postulaciones / maxMes) * 100) + '%' }"
                    :title="`${m.postulaciones} postulaciones`"
                  ></div>
                </div>
                <span class="month-label">{{ m.label }}</span>
              </div>
            </div>
            <div v-if="historicoMensual.length" class="legend">
              <span class="legend-item"><span class="legend-dot guardados"></span>Guardados</span>
              <span class="legend-item"><span class="legend-dot postulaciones"></span>Postulaciones</span>
            </div>
          </div>

        </div>

        <!-- Match promedio de mis postulaciones -->
        <div class="section full" v-if="conMatch.total > 0">
          <h2>Compatibilidad de tus postulaciones</h2>
          <p class="section-hint">De los fondos que tenés en pipeline, este es su nivel de match con tu proyecto</p>
          <div class="match-bars">
            <div class="match-row">
              <span class="match-label match-alto">Alto match (≥70%)</span>
              <div class="match-bar-wrap"><div class="match-bar alto" :style="{ width: pct(conMatch.alto, conMatch.total) + '%' }"></div></div>
              <span class="match-count">{{ conMatch.alto }}</span>
            </div>
            <div class="match-row">
              <span class="match-label match-medio">Match parcial (40-69%)</span>
              <div class="match-bar-wrap"><div class="match-bar medio" :style="{ width: pct(conMatch.medio, conMatch.total) + '%' }"></div></div>
              <span class="match-count">{{ conMatch.medio }}</span>
            </div>
            <div class="match-row">
              <span class="match-label match-bajo">Bajo match (&lt;40%)</span>
              <div class="match-bar-wrap"><div class="match-bar bajo" :style="{ width: pct(conMatch.bajo, conMatch.total) + '%' }"></div></div>
              <span class="match-count">{{ conMatch.bajo }}</span>
            </div>
          </div>
          <p class="section-tip" v-if="conMatch.bajo / conMatch.total > 0.4">
            💡 Más del 40% de tu pipeline tiene bajo match. Revisá los criterios de tu proyecto en
            <NuxtLink to="/dashboard/mi-perfil">Mi Perfil</NuxtLink> para mejorar el filtro.
          </p>
        </div>

      </template>
    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { calcularMatch, type Perfil } from '~/shared/match'

definePageMeta({ middleware: 'auth', layout: false })

const supabase = useSupabaseClient()
const { plan, load: loadPlan } = usePlan()

const loading = ref(true)
const totalGuardados     = ref(0)
const totalPostulaciones = ref(0)
const tasaAprobacion     = ref<number | null>(null)
const diasEnPlataforma   = ref(0)
const estadoCount        = ref<Record<string, number>>({})
const historicoMensual   = ref<{ key: string; label: string; guardados: number; postulaciones: number }[]>([])
const maxMes             = ref(1)
const conMatch           = ref({ total: 0, alto: 0, medio: 0, bajo: 0 })
const resumenFecha       = ref('')

const ESTADOS_FUNNEL = [
  { value: 'por_postular',   label: 'Por postular',    emoji: '📌' },
  { value: 'en_preparacion', label: 'En preparación',  emoji: '✍️' },
  { value: 'postulada',      label: 'Postulada',       emoji: '📤' },
  { value: 'aprobada',       label: 'Aprobada',        emoji: '🎉' },
  { value: 'rechazada',      label: 'Rechazada',       emoji: '🙁' },
] as const

const maxEstadoCount = computed(() => Math.max(1, ...Object.values(estadoCount.value)))
function barWidth(count: number | undefined): number {
  if (!count) return 4
  return Math.max(8, Math.round((count / maxEstadoCount.value) * 100))
}
function pct(v: number, total: number): number {
  if (!total) return 0
  return Math.max(4, Math.round((v / total) * 100))
}

onMounted(async () => {
  await loadPlan()
  if (plan.value === 'free') { loading.value = false; return }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) { loading.value = false; return }

  // Días en plataforma
  if (user.created_at) {
    const dias = Math.floor((Date.now() - new Date(user.created_at).getTime()) / 86400000)
    diasEnPlataforma.value = Math.max(0, dias)
  }
  resumenFecha.value = new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })

  // Cargar todo en paralelo
  const [guardadosRes, postulacionesRes, proyectoRes] = await Promise.all([
    supabase.from('guardados').select('convocatoria_id, created_at', { count: 'exact' }),
    supabase.from('postulaciones').select('convocatoria_id, estado, postulado_at'),
    supabase
      .from('proyectos')
      .select('tipo_persona, estado_proyecto, foco, alcance, monto_minimo')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  const guardados = guardadosRes.data ?? []
  const posts     = postulacionesRes.data ?? []

  totalGuardados.value     = guardados.length
  totalPostulaciones.value = posts.length

  // Estado count
  const counts: Record<string, number> = {}
  for (const p of posts) counts[(p as any).estado ?? 'postulada'] = (counts[(p as any).estado ?? 'postulada'] ?? 0) + 1
  estadoCount.value = counts

  // Tasa de aprobación: aprobadas / (aprobadas + rechazadas)
  const aprob = counts['aprobada']  ?? 0
  const rech  = counts['rechazada'] ?? 0
  tasaAprobacion.value = (aprob + rech) > 0 ? Math.round((aprob / (aprob + rech)) * 100) : null

  // Histórico mensual de últimos 6 meses
  const ahora = new Date()
  const buckets: typeof historicoMensual.value = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1)
    buckets.push({
      key:   `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('es-CL', { month: 'short' }),
      guardados:     0,
      postulaciones: 0,
    })
  }
  const idxByKey = Object.fromEntries(buckets.map((b, i) => [b.key, i]))
  function bucketKey(iso: string | null | undefined) {
    if (!iso) return null
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  for (const g of guardados) {
    const k = bucketKey((g as any).created_at); if (k && idxByKey[k] !== undefined) buckets[idxByKey[k]].guardados++
  }
  for (const p of posts) {
    const k = bucketKey((p as any).postulado_at); if (k && idxByKey[k] !== undefined) buckets[idxByKey[k]].postulaciones++
  }
  historicoMensual.value = buckets
  maxMes.value           = Math.max(1, ...buckets.map(b => b.guardados + b.postulaciones))

  // Match de las postulaciones contra el proyecto del usuario
  const proy = proyectoRes.data as any
  if (proy?.tipo_persona && proy?.estado_proyecto && posts.length) {
    const perfil: Perfil = {
      tipo_persona:    proy.tipo_persona,
      estado_proyecto: proy.estado_proyecto,
      foco:            proy.foco ?? [],
      alcance:         proy.alcance ?? [],
      monto_minimo:    proy.monto_minimo ?? null,
    }
    const ids = posts.map(p => p.convocatoria_id)
    const { data: convs } = await supabase
      .from('convocatorias')
      .select('id, foco, alcance, monto_rango, perfil_tipo_persona, perfil_nivel_desarrollo, perfil_antiguedad_empresa, perfil_nivel_ventas')
      .in('id', ids)
    let alto = 0, medio = 0, bajo = 0
    for (const c of convs ?? []) {
      const m = calcularMatch(perfil, c)
      if (m.nivel === 'alto')      alto++
      else if (m.nivel === 'medio') medio++
      else                          bajo++
    }
    conMatch.value = { total: (convs?.length ?? 0), alto, medio, bajo }
  }

  loading.value = false
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.content { flex: 1; padding: 2rem 2.5rem; font-family: 'Inter', sans-serif; }
.header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1.5rem; gap: 1rem; flex-wrap: wrap; }
h1 { font-size: 1.625rem; font-weight: 700; color: #0f172a; letter-spacing: -0.025em; }
.subtitle { font-size: 0.875rem; color: #64748b; margin-top: 0.25rem; }
.header-meta { font-size: 0.75rem; color: #94a3b8; align-self: center; }

/* KPIs */
.kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
.kpi-card { background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 0.2rem; }
.kpi-num { font-size: 2rem; font-weight: 800; color: #0f172a; letter-spacing: -0.04em; line-height: 1; }
.kpi-num small { font-size: 1rem; font-weight: 600; opacity: 0.7; margin-left: 2px; }
.kpi-label { font-size: 0.78rem; color: #64748b; font-weight: 500; }
.kpi-hint { font-size: 0.7rem; color: #cbd5e1; margin-top: 0.15rem; }
.accent-blue   .kpi-num { color: #0ea5e9; }
.accent-green  .kpi-num { color: #16a34a; }
.accent-purple .kpi-num { color: #6366f1; }

/* Grid 2 */
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }

.section { background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1.5rem; }
.section.full { grid-column: 1 / -1; }
.section h2 { font-size: 0.78rem; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 1rem; }
.section-hint { font-size: 0.8rem; color: #64748b; margin-bottom: 1rem; margin-top: -0.5rem; }
.section-empty { color: #94a3b8; font-size: 0.85rem; padding: 1rem 0; }
.section-tip { margin-top: 1rem; padding: 0.625rem 1rem; background: #fefce8; border-left: 3px solid #fbbf24; border-radius: 6px; font-size: 0.82rem; color: #78350f; }
.section-tip a { color: #0ea5e9; font-weight: 600; }

/* Funnel */
.funnel { display: flex; flex-direction: column; gap: 0.625rem; }
.funnel-row { display: flex; align-items: center; gap: 0.75rem; }
.funnel-label { display: flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; color: #475569; font-weight: 500; width: 140px; flex-shrink: 0; }
.funnel-emoji { font-size: 0.95rem; }
.funnel-bar-wrap { flex: 1; height: 10px; background: #f1f5f9; border-radius: 999px; overflow: hidden; }
.funnel-bar { height: 100%; border-radius: 999px; transition: width 0.4s ease; min-width: 4px; }
.funnel-bar.por_postular   { background: #cbd5e1; }
.funnel-bar.en_preparacion { background: #fbbf24; }
.funnel-bar.postulada      { background: #0ea5e9; }
.funnel-bar.aprobada       { background: #16a34a; }
.funnel-bar.rechazada      { background: #94a3b8; }
.funnel-count { font-size: 0.85rem; font-weight: 700; color: #0f172a; width: 30px; text-align: right; flex-shrink: 0; }

/* Histórico mensual */
.month-bars { display: flex; gap: 0.5rem; align-items: flex-end; height: 140px; padding-bottom: 1.25rem; }
.month-col { display: flex; flex-direction: column; align-items: center; gap: 0.3rem; flex: 1; height: 100%; }
.month-stack { flex: 1; width: 60%; display: flex; flex-direction: column-reverse; justify-content: flex-start; gap: 1px; }
.month-segment { width: 100%; min-height: 2px; border-radius: 3px; }
.month-segment.guardados     { background: #bae6fd; }
.month-segment.postulaciones { background: #0ea5e9; }
.month-label { font-size: 0.7rem; color: #94a3b8; text-transform: capitalize; }
.legend { display: flex; gap: 1rem; margin-top: 0.5rem; }
.legend-item { display: flex; align-items: center; gap: 0.35rem; font-size: 0.72rem; color: #64748b; }
.legend-dot { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
.legend-dot.guardados     { background: #bae6fd; }
.legend-dot.postulaciones { background: #0ea5e9; }

/* Match bars */
.match-bars { display: flex; flex-direction: column; gap: 0.625rem; }
.match-row { display: flex; align-items: center; gap: 0.75rem; }
.match-label { font-size: 0.82rem; font-weight: 600; width: 180px; flex-shrink: 0; }
.match-label.match-alto   { color: #15803d; }
.match-label.match-medio  { color: #a16207; }
.match-label.match-bajo   { color: #dc2626; }
.match-bar-wrap { flex: 1; height: 10px; background: #f1f5f9; border-radius: 999px; overflow: hidden; }
.match-bar { height: 100%; border-radius: 999px; transition: width 0.4s ease; }
.match-bar.alto  { background: #16a34a; }
.match-bar.medio { background: #fbbf24; }
.match-bar.bajo  { background: #ef4444; }
.match-count { font-size: 0.85rem; font-weight: 700; color: #0f172a; width: 30px; text-align: right; flex-shrink: 0; }

/* Empty */
.empty { display: flex; flex-direction: column; align-items: center; padding: 4rem 2rem; text-align: center; gap: 0.5rem; }
.empty-icon { font-size: 2.5rem; margin-bottom: 0.5rem; }
.empty-title { font-size: 1rem; font-weight: 600; color: #0f172a; }
.empty-desc { font-size: 0.85rem; color: #64748b; max-width: 420px; line-height: 1.55; }
.btn-primary { margin-top: 0.5rem; padding: 0.625rem 1.25rem; background: #0ea5e9; color: white; font-size: 0.875rem; font-weight: 600; border-radius: 10px; text-decoration: none; }

/* Upgrade */
.upgrade-wrap { max-width: 580px; }
.upgrade-card { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 2.5rem; text-align: center; }
.upgrade-plan-actual { display: inline-block; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #64748b; background: #f1f5f9; padding: 0.25rem 0.75rem; border-radius: 999px; margin-bottom: 1.25rem; }
.upgrade-title { font-size: 1.375rem; font-weight: 800; color: #0f172a; margin-bottom: 0.75rem; }
.upgrade-desc { font-size: 0.95rem; color: #64748b; line-height: 1.65; margin-bottom: 1.5rem; }
.btn-upgrade { display: inline-flex; align-items: center; background: #0ea5e9; color: white; padding: 0.75rem 1.5rem; border-radius: 10px; font-weight: 700; text-decoration: none; }
.btn-upgrade:hover { background: #0284c7; }

/* Skeleton */
@keyframes shimmer { from { background-position: -600px 0; } to { background-position: 600px 0; } }
.sk-card { pointer-events: none; }
.sk-block { background: linear-gradient(90deg, #f1f5f9 25%, #e8edf3 50%, #f1f5f9 75%); background-size: 1200px 100%; animation: shimmer 1.5s infinite; border-radius: 6px; }

@media (max-width: 900px) {
  .kpi-row { grid-template-columns: 1fr 1fr; }
  .grid-2  { grid-template-columns: 1fr; }
  .content { padding: 1.5rem 1rem; }
}
@media (max-width: 480px) {
  .kpi-row { grid-template-columns: 1fr; }
}
</style>
