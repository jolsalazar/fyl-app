<template>
  <NuxtLayout name="dashboard">
    <div class="content">
      <div class="header">
        <div>
          <h1>Métricas</h1>
          <p class="subtitle">Resumen del negocio</p>
        </div>
      </div>

      <div v-if="loading" class="loading">Cargando…</div>
      <template v-else>

        <!-- Stats cards -->
        <div class="stats-row">
          <div class="stat-card">
            <span class="stat-num">{{ total }}</span>
            <span class="stat-label">Usuarios totales</span>
          </div>
          <div class="stat-card accent-green">
            <span class="stat-num">{{ pagados }}</span>
            <span class="stat-label">Pagados</span>
            <span class="stat-sub">{{ total ? Math.round(pagados / total * 100) : 0 }}% del total</span>
          </div>
          <div class="stat-card">
            <span class="stat-num">{{ byPlan.free }}</span>
            <span class="stat-label">Free</span>
          </div>
          <div class="stat-card accent-advanced">
            <span class="stat-num">{{ byPlan.advanced }}</span>
            <span class="stat-label">Advanced</span>
          </div>
          <div class="stat-card accent-agency">
            <span class="stat-num">{{ byPlan.agency }}</span>
            <span class="stat-label">Agency</span>
          </div>
          <div class="stat-card accent-blue">
            <span class="stat-num">{{ nuevosEstaSemana }}</span>
            <span class="stat-label">Nuevos esta semana</span>
          </div>
        </div>

        <!-- Plan distribution -->
        <div class="section">
          <h2>Distribución por plan</h2>
          <div class="distrib-wrap">
            <div class="distrib-bar">
              <div class="bar-seg seg-free"     :style="{ width: pct(byPlan.free) + '%' }"     v-if="byPlan.free"></div>
              <div class="bar-seg seg-advanced" :style="{ width: pct(byPlan.advanced) + '%' }" v-if="byPlan.advanced"></div>
              <div class="bar-seg seg-agency"   :style="{ width: pct(byPlan.agency) + '%' }"   v-if="byPlan.agency"></div>
            </div>
            <div class="distrib-legend">
              <div class="legend-item"><span class="dot dot-free"></span>Free — {{ byPlan.free }} ({{ pct(byPlan.free) }}%)</div>
              <div class="legend-item"><span class="dot dot-advanced"></span>Advanced — {{ byPlan.advanced }} ({{ pct(byPlan.advanced) }}%)</div>
              <div class="legend-item"><span class="dot dot-agency"></span>Agency — {{ byPlan.agency }} ({{ pct(byPlan.agency) }}%)</div>
            </div>
          </div>
        </div>

        <!-- Registros por semana -->
        <div class="section" v-if="semanas.length">
          <h2>Registros por semana <span class="h2-sub">(últimas 8 semanas)</span></h2>
          <div class="chart">
            <div v-for="s in semanasPadded" :key="s.semana" class="chart-col">
              <div class="bar-wrap">
                <span v-if="s.total > 0" class="bar-val">{{ s.total }}</span>
                <div class="bar" :style="{ height: barHeight(s.total) + '%' }"></div>
              </div>
              <span class="bar-label">{{ semanaLabel(s.semana) }}</span>
            </div>
          </div>
        </div>

        <!-- Email clicks -->
        <div class="section">
          <h2>Clicks desde email <span class="h2-sub">(últimos 30 días)</span></h2>

          <div v-if="loadingClicks" class="loading">Cargando…</div>
          <template v-else>

            <!-- Resumen -->
            <div class="email-stats">
              <div class="email-stat">
                <span class="email-num">{{ totalClicks }}</span>
                <span class="email-label">Clicks totales</span>
              </div>
              <div class="email-stat">
                <span class="email-num">{{ usuariosUnicos }}</span>
                <span class="email-label">Usuarios únicos</span>
              </div>
              <div class="email-stat">
                <span class="email-num">{{ fondosUnicos }}</span>
                <span class="email-label">Fondos distintos</span>
              </div>
            </div>

            <!-- Fondos más clickeados -->
            <div v-if="topFondos.length" style="margin-top:1.25rem">
              <p class="tabla-title">Fondos más clickeados</p>
              <table class="tabla">
                <thead>
                  <tr>
                    <th>Convocatoria</th>
                    <th class="col-num">Clicks</th>
                    <th class="col-num">Último click</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="f in topFondos" :key="f.convocatoria_id">
                    <td>
                      <NuxtLink :to="`/dashboard/oportunidades/${f.convocatoria_id}`" class="link-fondo">
                        {{ f.titulo || f.convocatoria_id }}
                      </NuxtLink>
                    </td>
                    <td class="col-num"><span class="badge-click">{{ f.clicks }}</span></td>
                    <td class="col-num text-muted">{{ formatFecha(f.ultimo_click) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Usuarios más activos -->
            <div v-if="topUsuarios.length" style="margin-top:1.5rem">
              <p class="tabla-title">Usuarios más activos por email</p>
              <table class="tabla">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th class="col-num">Clicks</th>
                    <th class="col-num">Último click</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="u in topUsuarios" :key="u.user_id">
                    <td class="text-mono">{{ u.email }}</td>
                    <td class="col-num"><span class="badge-click">{{ u.clicks }}</span></td>
                    <td class="col-num text-muted">{{ formatFecha(u.ultimo_click) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div v-if="!topFondos.length && !topUsuarios.length" class="empty-clicks">
              Aún no hay clicks registrados desde emails.
            </div>
          </template>
        </div>

      </template>
    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'], layout: false })

const supabase = useSupabaseClient()

interface UserRow { id: string; plan: string; created_at: string }
interface SemanaRow { semana: string; total: number }

const users = ref<UserRow[]>([])
const semanas = ref<SemanaRow[]>([])
const loading = ref(true)

const total = computed(() => users.value.length)
const byPlan = computed(() => ({
  free:    users.value.filter(u => u.plan === 'free').length,
  advanced: users.value.filter(u => u.plan === 'advanced').length,
  agency:   users.value.filter(u => u.plan === 'agency').length,
}))
const pagados = computed(() => byPlan.value.advanced + byPlan.value.agency)

const nuevosEstaSemana = computed(() => {
  const hace7 = new Date(); hace7.setDate(hace7.getDate() - 7)
  return users.value.filter(u => new Date(u.created_at) >= hace7).length
})

const semanasPadded = computed(() => {
  const map = Object.fromEntries(semanas.value.map(s => [s.semana, s.total]))
  const result = []
  for (let i = 7; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i * 7)
    const lunes = startOfWeek(d)
    const key = lunes.toISOString().split('T')[0]
    result.push({ semana: key, total: map[key] ?? 0 })
  }
  return result
})

const maxSemana = computed(() => Math.max(...semanasPadded.value.map(s => s.total), 1))

function barHeight(val: number) {
  return Math.max((val / maxSemana.value) * 100, val > 0 ? 4 : 0)
}

function pct(val: number) {
  if (!total.value) return 0
  return Math.round(val / total.value * 100)
}

function startOfWeek(d: Date) {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff))
}

function semanaLabel(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
}

// ── Email clicks ──────────────────────────────────────────────────
interface ClickFondo   { convocatoria_id: string; titulo: string; clicks: number; ultimo_click: string }
interface ClickUsuario { user_id: string; email: string; clicks: number; ultimo_click: string }

const loadingClicks = ref(true)
const topFondos     = ref<ClickFondo[]>([])
const topUsuarios   = ref<ClickUsuario[]>([])

const totalClicks   = computed(() => topFondos.value.reduce((s, f) => s + f.clicks, 0))
const usuariosUnicos = computed(() => topUsuarios.value.length)
const fondosUnicos  = computed(() => topFondos.value.length)

)
}

onMounted(async () => {
  const [{ data: u }, { data: s }] = await Promise.all([
    supabase.rpc('admin_get_users'),
    supabase.rpc('admin_registros_semana'),
  ])
  users.value   = u ?? []
  semanas.value = (s ?? []).map((r: any) => ({ semana: r.semana, total: Number(r.total) }))
  loading.value = false

  // Email clicks — últimos 30 días
  const desde30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data: clicks } = await supabase
    .from('email_clicks')
    .select('convocatoria_id, alerta_id, user_id, clicked_at')
    .gte('clicked_at', desde30)
    .order('clicked_at', { ascending: false })

  if (clicks?.length) {
    // Agrupar por convocatoria
    const byFondo = new Map<string, { clicks: number; ultimo_click: string }>()
    for (const c of clicks) {
      const prev = byFondo.get(c.convocatoria_id)
      if (!prev) byFondo.set(c.convocatoria_id, { clicks: 1, ultimo_click: c.clicked_at })
      else { prev.clicks++; if (c.clicked_at > prev.ultimo_click) prev.ultimo_click = c.clicked_at }
    }

    // Obtener títulos de convocatorias
    const ids = [...byFondo.keys()].filter(Boolean)
    const { data: convs } = ids.length
      ? await supabase.from('convocatorias').select('id, titulo').in('id', ids)
      : { data: [] }
    const tituloMap = Object.fromEntries((convs ?? []).map((c: any) => [c.id, c.titulo]))

    topFondos.value = [...byFondo.entries()]
      .map(([id, v]) => ({ convocatoria_id: id, titulo: tituloMap[id] ?? id, ...v }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10)

    // Agrupar por usuario
    const byUser = new Map<string, { clicks: number; ultimo_click: string }>()
    for (const c of clicks) {
      if (!c.user_id) continue
      const prev = byUser.get(c.user_id)
      if (!prev) byUser.set(c.user_id, { clicks: 1, ultimo_click: c.clicked_at })
      else { prev.clicks++; if (c.clicked_at > prev.ultimo_click) prev.ultimo_click = c.clicked_at }
    }

    // Obtener emails de usuarios
    const uids = [...byUser.keys()]
    const { data: perfiles } = uids.length
      ? await supabase.from('profiles').select('id, email:id').in('id', uids)
      : { data: [] }

    // Obtener emails via auth (profiles no tiene email directo)
    const { data: authUsers } = uids.length
      ? await supabase.rpc('admin_get_users')
      : { data: [] }
    const emailMap = Object.fromEntries((authUsers ?? []).map((u: any) => [u.id, u.email]))

    topUsuarios.value = [...byUser.entries()]
      .map(([uid, v]) => ({ user_id: uid, email: emailMap[uid] ?? uid, ...v }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10)
  }

  loadingClicks.value = false
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.content { flex: 1; padding: 2rem 2.5rem; font-family: 'Inter', sans-serif; }
.header { margin-bottom: 1.75rem; }
h1 { font-size: 1.625rem; font-weight: 700; color: #0f172a; letter-spacing: -0.025em; }
.subtitle { font-size: 0.875rem; color: #64748b; margin-top: 0.2rem; }
.loading { padding: 3rem; text-align: center; color: #64748b; font-size: 0.9rem; }

.stats-row { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 2rem; }
.stat-card {
  background: white; border: 1px solid #e2e8f0; border-radius: 12px;
  padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 0.2rem; min-width: 120px;
}
.stat-num { font-size: 2rem; font-weight: 800; color: #0f172a; line-height: 1; }
.stat-label { font-size: 0.8125rem; color: #64748b; font-weight: 500; }
.stat-sub { font-size: 0.75rem; color: #94a3b8; }
.accent-green .stat-num { color: #16a34a; }
.accent-advanced .stat-num { color: #6366f1; }
.accent-agency .stat-num { color: #0ea5e9; }
.accent-blue .stat-num { color: #0ea5e9; }

.section {
  background: white; border: 1px solid #e2e8f0; border-radius: 12px;
  padding: 1.5rem; margin-bottom: 1.5rem;
}
h2 { font-size: 0.875rem; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1.25rem; }
.h2-sub { font-size: 0.75rem; color: #94a3b8; text-transform: none; letter-spacing: 0; font-weight: 500; }

/* Plan distribution */
.distrib-bar {
  height: 12px; border-radius: 999px; overflow: hidden;
  background: #f1f5f9; display: flex; margin-bottom: 1rem;
}
.bar-seg { height: 100%; transition: width 0.4s; }
.seg-free    { background: #cbd5e1; }
.seg-advanced { background: #818cf8; }
.seg-agency   { background: #38bdf8; }

.distrib-legend { display: flex; gap: 1.5rem; flex-wrap: wrap; }
.legend-item { display: flex; align-items: center; gap: 0.4rem; font-size: 0.8125rem; color: #475569; }
.dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.dot-free    { background: #cbd5e1; }
.dot-advanced { background: #818cf8; }
.dot-agency   { background: #38bdf8; }

/* Chart */
.chart {
  display: flex; align-items: flex-end; gap: 0.5rem;
  height: 140px; padding-top: 1.5rem;
}
.chart-col {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.4rem;
}
.bar-wrap {
  flex: 1; width: 100%; display: flex; flex-direction: column;
  align-items: center; justify-content: flex-end; position: relative;
}
.bar-val {
  font-size: 0.7rem; font-weight: 700; color: #475569;
  position: absolute; top: -1.1rem;
}
.bar {
  width: 100%; background: #0ea5e9; border-radius: 4px 4px 0 0;
  min-height: 0; transition: height 0.3s;
}
.bar-label { font-size: 0.65rem; color: #94a3b8; white-space: nowrap; }

/* Email clicks */
.email-stats {
  display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.25rem;
}
.email-stat {
  background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;
  padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0.2rem; min-width: 110px;
}
.email-num   { font-size: 1.75rem; font-weight: 800; color: #0ea5e9; line-height: 1; }
.email-label { font-size: 0.8rem; color: #64748b; font-weight: 500; }

.tabla-title { font-size: 0.8rem; font-weight: 600; color: #475569; margin-bottom: 0.625rem; }
.tabla {
  width: 100%; border-collapse: collapse; font-size: 0.875rem;
}
.tabla th {
  text-align: left; font-size: 0.75rem; font-weight: 600; color: #94a3b8;
  padding: 0.5rem 0.75rem; border-bottom: 1px solid #f1f5f9; text-transform: uppercase; letter-spacing: 0.04em;
}
.tabla td {
  padding: 0.625rem 0.75rem; border-bottom: 1px solid #f8fafc; color: #374151; vertical-align: middle;
}
.tabla tr:last-child td { border-bottom: none; }
.tabla tr:hover td { background: #f8fafc; }
.col-num   { text-align: right; white-space: nowrap; }
.text-muted { color: #94a3b8; font-size: 0.8125rem; }
.text-mono  { font-size: 0.8125rem; color: #475569; }
.link-fondo { color: #0f172a; text-decoration: none; font-weight: 500; }
.link-fondo:hover { color: #0ea5e9; }
.badge-click {
  display: inline-block; background: #f0f9ff; color: #0369a1;
  font-size: 0.75rem; font-weight: 700; padding: 0.15rem 0.5rem;
  border-radius: 999px; border: 1px solid #bae6fd;
}
.empty-clicks {
  padding: 2rem; text-align: center; color: #94a3b8; font-size: 0.875rem;
}
</style>
