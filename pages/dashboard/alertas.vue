<template>
  <NuxtLayout name="dashboard">
    <div class="content">
      <div class="header">
        <div>
          <h1>Mis Alertas</h1>
          <p class="subtitle">
            <template v-if="total !== null">{{ total }} oportunidades coinciden con tu perfil</template>
            <template v-else>Cargando…</template>
          </p>
        </div>
        <NuxtLink to="/dashboard/configuracion" class="btn-config">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          Editar perfil
        </NuxtLink>
      </div>

      <!-- Sin config -->
      <div v-if="!loading && !tieneConfig" class="empty">
        <div class="empty-icon">🔔</div>
        <p class="empty-title">Configura tu perfil de alertas</p>
        <p class="empty-desc">Agrega palabras clave, tipo de oportunidad o fuentes que te interesan para ver las oportunidades que calzan contigo.</p>
        <NuxtLink to="/dashboard/configuracion" class="btn-primary">Configurar ahora</NuxtLink>
      </div>

      <!-- Loading -->
      <div v-else-if="loading" class="empty"><div class="spinner"></div></div>

      <!-- Sin resultados -->
      <div v-else-if="items.length === 0" class="empty">
        <div class="empty-icon-wrap">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </div>
        <p class="empty-title">Sin resultados por ahora</p>
        <p class="empty-desc">No encontramos oportunidades abiertas que coincidan con tu perfil actual. Puedes ampliar los criterios en configuración.</p>
        <NuxtLink to="/dashboard/configuracion" class="btn-primary">Ajustar perfil</NuxtLink>
      </div>

      <!-- Resultados -->
      <template v-else>
        <!-- Resumen de filtros activos -->
        <div class="filtros-activos">
          <span v-for="f in filtrosActivos" :key="f" class="filtro-chip">{{ f }}</span>
        </div>

        <div class="lista">
          <div v-for="item in items" :key="item.id" class="card" :class="{ nueva: esNueva(item.fecha_scrapeado) }">
            <div v-if="esNueva(item.fecha_scrapeado)" class="nueva-chip">Nueva</div>
            <div class="card-top">
              <div class="tags">
                <span class="tag-fuente">{{ fuenteLabel(item.fuente) }}</span>
                <span class="tag-tipo" :class="item.tipo">{{ item.tipo === 'fondo' ? 'Fondo' : 'Licitación' }}</span>
              </div>
              <span :class="['badge-estado', item.estado]">{{ estadoLabel(item.estado) }}</span>
            </div>

            <NuxtLink :to="`/dashboard/oportunidades/${item.id}`" class="card-title-link">
              <h3>{{ item.titulo }}</h3>
            </NuxtLink>
            <p class="desc">{{ item.descripcion_breve }}</p>

            <div class="card-meta">
              <span v-if="item.monto_rango" class="meta-item">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                {{ montoLabel(item.monto_rango) }}
              </span>
              <span v-if="item.fecha_cierre_postulacion" class="meta-item" :class="{ urgente: esUrgente(item.fecha_cierre_postulacion) }">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Cierra {{ formatFecha(item.fecha_cierre_postulacion) }}
              </span>
            </div>

            <div class="card-footer">
              <div class="focos">
                <span v-for="f in (item.foco ?? []).slice(0, 3)" :key="f" class="foco-tag">{{ f }}</span>
              </div>
              <div class="card-links">
                <a v-if="item.link_postulacion" :href="item.link_postulacion" target="_blank" class="ver-link primary">
                  Postular
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </a>
                <NuxtLink :to="`/dashboard/oportunidades/${item.id}`" class="ver-link">Ver detalle</NuxtLink>
              </div>
            </div>
          </div>
        </div>

        <div v-if="items.length < (total ?? 0)" class="load-more">
          <button @click="cargarMas" :disabled="loadingMas" class="btn-more">
            {{ loadingMas ? 'Cargando...' : `Ver más (${(total ?? 0) - items.length} restantes)` }}
          </button>
        </div>
      </template>

    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: false })

const supabase = useSupabaseClient()
const PAGE_SIZE = 20

const loading = ref(true)
const loadingMas = ref(false)
const items = ref<any[]>([])
const total = ref<number | null>(null)
const offset = ref(0)
const lastVisit = ref('')

interface AlertConfig {
  palabras_clave: string[]
  tipos: string[]
  fuentes: string[]
  monto_rangos: string[]
  regiones: string[]
}

const config = ref<AlertConfig | null>(null)

const tieneConfig = computed(() => {
  if (!config.value) return false
  const c = config.value
  return c.palabras_clave.length > 0 || c.tipos.length > 0 || c.fuentes.length > 0 || c.monto_rangos.length > 0
})

const filtrosActivos = computed(() => {
  if (!config.value) return []
  const labels: string[] = []
  for (const k of config.value.palabras_clave) labels.push(`"${k}"`)
  for (const t of config.value.tipos) labels.push(t === 'fondo' ? 'Fondos' : 'Licitaciones')
  for (const f of config.value.fuentes) labels.push(fuenteLabel(f))
  for (const m of config.value.monto_rangos) labels.push(montoLabel(m))
  return labels
})

function buildQuery() {
  let q = supabase.from('convocatorias').select('*', { count: 'exact' }).eq('estado', 'abierto')

  if (config.value?.palabras_clave.length) {
    const terms = config.value.palabras_clave
      .flatMap(k => [`titulo.ilike.%${k}%`, `descripcion_breve.ilike.%${k}%`])
      .join(',')
    q = q.or(terms)
  }
  if (config.value?.tipos.length)        q = q.in('tipo', config.value.tipos)
  if (config.value?.fuentes.length)      q = q.in('fuente', config.value.fuentes)
  if (config.value?.monto_rangos.length) q = q.in('monto_rango', config.value.monto_rangos)

  return q.order('fecha_scrapeado', { ascending: false })
}

async function cargar() {
  loading.value = true
  offset.value = 0
  const { data, count } = await buildQuery().range(0, PAGE_SIZE - 1)
  items.value = data ?? []
  total.value = count ?? 0
  offset.value = items.value.length
  loading.value = false
}

async function cargarMas() {
  loadingMas.value = true
  const { data } = await buildQuery().range(offset.value, offset.value + PAGE_SIZE - 1)
  items.value = [...items.value, ...(data ?? [])]
  offset.value = items.value.length
  loadingMas.value = false
}

onMounted(async () => {
  lastVisit.value = localStorage.getItem('fyl_last_alertas') ?? ''
  localStorage.setItem('fyl_last_alertas', new Date().toISOString())

  const { data: { user } } = await supabase.auth.getUser()
  const { data } = await supabase
    .from('alert_configs')
    .select('palabras_clave, tipos, fuentes, monto_rangos, regiones')
    .eq('user_id', user!.id)
    .maybeSingle()

  config.value = data ? {
    palabras_clave: data.palabras_clave ?? [],
    tipos:          data.tipos ?? [],
    fuentes:        data.fuentes ?? [],
    monto_rangos:   data.monto_rangos ?? [],
    regiones:       data.regiones ?? [],
  } : null

  if (tieneConfig.value) await cargar()
  else loading.value = false
})

function esNueva(fechaScrapeado: string) {
  if (!lastVisit.value || !fechaScrapeado) return false
  return new Date(fechaScrapeado) > new Date(lastVisit.value)
}

function fuenteLabel(f: string) {
  const map: Record<string, string> = { corfo: 'CORFO', sercotec: 'SERCOTEC', anid: 'ANID', mercadopublico: 'Mercado Público', fondos_gob: 'Fondos.gob.cl' }
  return map[f] ?? f
}
function estadoLabel(e: string) {
  return { abierto: 'Abierto', cerrado: 'Cerrado', por_abrir: 'Por abrir' }[e] ?? e
}
function montoLabel(m: string) {
  const map: Record<string, string> = { hasta_1M: 'Hasta $1M', '1M_10M': '$1M – $10M', '10M_30M': '$10M – $30M', '30M_60M': '$30M – $60M', '60M_100M': '$60M – $100M', sobre_100M: 'Más de $100M' }
  return map[m] ?? m
}
function formatFecha(f: string) {
  if (!f) return '—'
  return new Date(f).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
}
function esUrgente(f: string) {
  const dias = (new Date(f).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  return dias >= 0 && dias <= 7
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.content { flex: 1; padding: 2rem 2.5rem; font-family: 'Inter', sans-serif; }

.header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1.75rem; gap: 1rem; }
h1 { font-size: 1.625rem; font-weight: 700; color: #0f172a; letter-spacing: -0.025em; }
.subtitle { font-size: 0.875rem; color: #64748b; margin-top: 0.2rem; }

.btn-config {
  display: inline-flex; align-items: center; gap: 0.4rem;
  padding: 0.5rem 1rem; background: white; border: 1.5px solid #e2e8f0;
  border-radius: 10px; font-size: 0.875rem; font-weight: 500; color: #475569;
  text-decoration: none; transition: all 0.15s; white-space: nowrap; font-family: 'Inter', sans-serif;
}
.btn-config:hover { border-color: #0ea5e9; color: #0ea5e9; }

.empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 5rem 2rem; text-align: center; gap: 0.75rem; }
.empty-icon { font-size: 2.5rem; margin-bottom: 0.25rem; }
.empty-icon-wrap { width: 56px; height: 56px; background: #f1f5f9; border-radius: 14px; display: flex; align-items: center; justify-content: center; }
.empty-title { font-size: 1rem; font-weight: 600; color: #0f172a; }
.empty-desc { font-size: 0.875rem; color: #64748b; max-width: 400px; line-height: 1.6; }
.btn-primary { margin-top: 0.5rem; padding: 0.625rem 1.25rem; background: #0ea5e9; color: white; font-size: 0.9rem; font-weight: 600; border-radius: 10px; text-decoration: none; transition: background 0.15s; }
.btn-primary:hover { background: #0284c7; }

.filtros-activos { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 1.25rem; }
.filtro-chip { font-size: 0.75rem; font-weight: 600; padding: 0.25rem 0.65rem; background: #f0f9ff; border: 1px solid #bae6fd; color: #0369a1; border-radius: 999px; }

.lista { display: flex; flex-direction: column; gap: 0.75rem; }
.card { background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1.25rem 1.5rem; transition: box-shadow 0.15s, border-color 0.15s; position: relative; }
.card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.06); border-color: #cbd5e1; }
.card.nueva { border-left: 3px solid #0ea5e9; }

.nueva-chip { position: absolute; top: 1rem; right: 1rem; font-size: 0.65rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; background: #0ea5e9; color: white; padding: 0.15rem 0.5rem; border-radius: 999px; }

.card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.625rem; gap: 0.5rem; }
.tags { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.tag-fuente { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #0ea5e9; }
.tag-tipo { font-size: 0.7rem; font-weight: 600; padding: 0.15rem 0.5rem; border-radius: 999px; }
.tag-tipo.fondo { background: #f0fdf4; color: #16a34a; }
.tag-tipo.licitacion { background: #eef2ff; color: #4338ca; }
.badge-estado { font-size: 0.7rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 999px; letter-spacing: 0.03em; text-transform: uppercase; white-space: nowrap; }
.badge-estado.abierto  { background: #f0fdf4; color: #16a34a; }
.badge-estado.cerrado  { background: #f1f5f9; color: #94a3b8; }
.badge-estado.por_abrir { background: #fefce8; color: #a16207; }

.card-title-link { text-decoration: none; }
.card-title-link:hover h3 { color: #0ea5e9; }
.card h3 { font-size: 0.9375rem; font-weight: 600; color: #0f172a; margin-bottom: 0.375rem; line-height: 1.4; transition: color 0.15s; }
.desc { font-size: 0.875rem; color: #64748b; line-height: 1.55; }

.card-meta { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.875rem; }
.meta-item { display: flex; align-items: center; gap: 0.3rem; font-size: 0.8rem; color: #94a3b8; font-weight: 500; }
.meta-item.urgente { color: #f59e0b; font-weight: 600; }

.card-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; padding-top: 0.875rem; border-top: 1px solid #f1f5f9; gap: 0.75rem; flex-wrap: wrap; }
.focos { display: flex; gap: 0.35rem; flex-wrap: wrap; }
.foco-tag { font-size: 0.7rem; font-weight: 500; padding: 0.2rem 0.5rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; color: #64748b; }
.card-links { display: flex; gap: 0.75rem; align-items: center; }
.ver-link { display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.8125rem; font-weight: 600; color: #94a3b8; text-decoration: none; transition: color 0.15s; }
.ver-link:hover { color: #64748b; }
.ver-link.primary { color: #0ea5e9; background: #f0f9ff; padding: 0.35rem 0.75rem; border-radius: 8px; border: 1px solid #bae6fd; }
.ver-link.primary:hover { background: #e0f2fe; }

.load-more { text-align: center; margin-top: 1.5rem; }
.btn-more { padding: 0.625rem 1.5rem; background: white; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 0.875rem; font-weight: 500; font-family: inherit; color: #475569; cursor: pointer; transition: all 0.15s; }
.btn-more:hover { border-color: #0ea5e9; color: #0ea5e9; }
.btn-more:disabled { opacity: 0.5; cursor: not-allowed; }

.spinner { width: 28px; height: 28px; border: 3px solid #e2e8f0; border-top-color: #0ea5e9; border-radius: 50%; animation: spin 0.65s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
