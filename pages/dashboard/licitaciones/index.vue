<template>
  <NuxtLayout name="dashboard">
    <div class="content">

      <!-- Header -->
      <div class="header">
        <div>
          <h1>Licitaciones</h1>
          <p class="subtitle">
            {{ total !== null ? `${total} licitaciones encontradas` : 'Cargando...' }}
            <span v-if="nuevosEstaSemana > 0" class="badge-nuevos">+{{ nuevosEstaSemana }} esta semana</span>
          </p>
        </div>
        <NuxtLink v-if="!canExport" to="/planes" class="btn-config btn-export-locked" title="Disponible en Plan Pro">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          Exportar CSV
          <span class="btn-pro-tag">Pro</span>
        </NuxtLink>
        <button v-else class="btn-config" @click="exportarCSV" :disabled="exportando">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          {{ exportando ? 'Exportando…' : 'Exportar CSV' }}
        </button>
        <NuxtLink to="/dashboard/configuracion" class="btn-config">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          Mis alertas
        </NuxtLink>
      </div>

      <!-- Filtros -->
      <div class="filtros">
        <div class="search-wrap">
          <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input v-model="busqueda" type="text" placeholder="Buscar por título..." class="search-input" @input="onBusqueda" />
        </div>

        <select v-model="filtroEstado" @change="cargar" class="select">
          <option value="">Todos los estados</option>
          <option value="abierto">Abierto</option>
          <option value="por_abrir">Por abrir</option>
          <option value="cerrado">Cerrado</option>
        </select>

        <select v-model="filtroMonto" @change="cargar" class="select">
          <option value="">Cualquier monto</option>
          <option value="hasta_1M">Hasta $1M</option>
          <option value="1M_10M">$1M – $10M</option>
          <option value="10M_30M">$10M – $30M</option>
          <option value="30M_60M">$30M – $60M</option>
          <option value="60M_100M">$60M – $100M</option>
          <option value="sobre_100M">Más de $100M</option>
        </select>

        <button v-if="hayFiltros" class="btn-clear" @click="limpiarFiltros">
          Limpiar filtros
        </button>
      </div>

      <!-- Sort -->
      <div class="sort-bar">
        <span class="sort-label">Ordenar por:</span>
        <button :class="['sort-btn', orden === 'cierre' ? 'active' : '']" @click="setOrden('cierre')">Cierre próximo</button>
        <button :class="['sort-btn', orden === 'reciente' ? 'active' : '']" @click="setOrden('reciente')">Más reciente</button>
      </div>

      <!-- Loading skeleton -->
      <div v-if="loading" class="lista">
        <div v-for="i in 5" :key="i" class="card sk-card">
          <div class="sk-top">
            <div class="sk-row"><div class="sk-block sk-tag"></div><div class="sk-block sk-tag"></div></div>
            <div class="sk-block sk-badge"></div>
          </div>
          <div class="sk-block sk-title"></div>
          <div class="sk-block sk-line"></div>
          <div class="sk-block sk-line sk-short"></div>
          <div class="sk-meta"><div class="sk-block sk-pill"></div><div class="sk-block sk-pill"></div></div>
        </div>
      </div>

      <!-- Sin resultados -->
      <div v-else-if="items.length === 0" class="empty">
        <div class="empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </div>
        <p class="empty-title">Sin resultados</p>
        <p class="empty-desc" v-if="hayFiltros">Ninguna licitación coincide con los filtros aplicados.</p>
        <p class="empty-desc" v-else>Aún no hay licitaciones disponibles.</p>
        <button v-if="hayFiltros" class="btn-empty-clear" @click="limpiarFiltros">Limpiar filtros</button>
      </div>

      <!-- Lista -->
      <div v-else class="lista">
        <div v-for="item in items" :key="item.id" class="card" @click="saveScroll">
          <div class="card-top">
            <div class="tags">
              <span class="tag-fuente">{{ fuenteLabel(item.fuente) }}</span>
              <span class="tag-tipo" :class="item.tipo">{{ item.tipo === 'fondo' ? 'Fondo' : 'Licitación' }}</span>
            </div>
            <div class="card-top-right">
              <span :class="['badge-estado', item.estado]">{{ estadoLabel(item.estado) }}</span>
              <button
                :class="['btn-guardar', guardadosSet.has(item.id) ? 'guardado' : '']"
                @click.prevent="toggleGuardado(item.id)"
                :title="guardadosSet.has(item.id) ? 'Quitar de guardados' : 'Guardar'"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" :fill="guardadosSet.has(item.id) ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
              </button>
            </div>
          </div>

          <NuxtLink :to="`/dashboard/licitaciones/${item.id}`" class="card-title-link"><h3>{{ item.titulo }}</h3></NuxtLink>
          <p class="desc">{{ item.descripcion_breve }}</p>

          <div class="card-meta">
            <span v-if="item.monto_rango" class="meta-item">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              {{ montoLabel(item.monto_rango) }}
            </span>
            <span v-if="item.fecha_cierre_postulacion && esUrgente(item.fecha_cierre_postulacion)" class="chip-urgente">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Cierra en {{ diasRestantes(item.fecha_cierre_postulacion) }} día{{ diasRestantes(item.fecha_cierre_postulacion) === 1 ? '' : 's' }}
            </span>
            <span v-else-if="item.fecha_cierre_postulacion" class="meta-item">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Cierra {{ formatFecha(item.fecha_cierre_postulacion) }}
            </span>
            <span v-if="item.alcance" class="meta-item">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              {{ alcanceLabel(item.alcance) }}
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
              <NuxtLink :to="`/dashboard/licitaciones/${item.id}`" class="ver-link">
                Ver detalle
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>

      <!-- Load more -->
      <div v-if="items.length > 0 && items.length < (total ?? 0)" class="load-more">
        <button @click="cargarMas" :disabled="loadingMas" class="btn-more">
          <span v-if="loadingMas" class="spinner-sm"></span>
          {{ loadingMas ? 'Cargando...' : `Ver más (${(total ?? 0) - items.length} restantes)` }}
        </button>
      </div>

    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: false })

const supabase = useSupabaseClient()
const route = useRoute()
const router = useRouter()
const { show: toast } = useToast()
const { plan, load: loadPlan } = usePlan()
const canExport = computed(() => plan.value === 'pro' || plan.value === 'agencia')

const FUENTE = 'mercadopublico'
const PAGE_SIZE = 20
const SCROLL_KEY = 'scroll_licitaciones'
const guardadosSet = ref<Set<string>>(new Set())
const nuevosEstaSemana = ref(0)

const loading = ref(true)
const loadingMas = ref(false)
const items = ref<any[]>([])
const total = ref<number | null>(null)
const offset = ref(0)

const busqueda = ref((route.query.q as string) || '')
const filtroEstado = ref((route.query.estado as string) || 'abierto')
const filtroMonto = ref((route.query.monto as string) || '')
const orden = ref<'cierre' | 'reciente'>(route.query.orden === 'reciente' ? 'reciente' : 'cierre')

watch([busqueda, filtroEstado, filtroMonto, orden], () => {
  const q: Record<string, string> = {}
  if (busqueda.value) q.q = busqueda.value
  if (filtroEstado.value !== 'abierto') q.estado = filtroEstado.value
  if (filtroMonto.value) q.monto = filtroMonto.value
  if (orden.value !== 'cierre') q.orden = orden.value
  router.replace({ query: q })
})

let busquedaTimer: ReturnType<typeof setTimeout>

const hayFiltros = computed(() =>
  busqueda.value || filtroEstado.value !== 'abierto' || filtroMonto.value
)

function buildQuery() {
  let q = supabase.from('convocatorias').select('*', { count: 'exact' })
  q = q.eq('fuente', FUENTE)
  if (filtroEstado.value) q = q.eq('estado', filtroEstado.value)
  if (filtroMonto.value)  q = q.eq('monto_rango', filtroMonto.value)
  if (busqueda.value)     q = q.ilike('titulo', `%${busqueda.value}%`)
  if (orden.value === 'cierre') {
    q = q.order('fecha_cierre_postulacion', { ascending: true, nullsFirst: false })
  } else {
    q = q.order('fecha_scrapeado', { ascending: false })
  }
  return q
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

function onBusqueda() {
  clearTimeout(busquedaTimer)
  busquedaTimer = setTimeout(cargar, 350)
}

function setOrden(o: 'cierre' | 'reciente') {
  orden.value = o
  cargar()
}

function limpiarFiltros() {
  busqueda.value = ''
  filtroEstado.value = 'abierto'
  filtroMonto.value = ''
  cargar()
}

// Labels
function fuenteLabel(f: string) {
  const map: Record<string, string> = {
    corfo: 'CORFO', sercotec: 'SERCOTEC', anid: 'ANID',
    mercadopublico: 'Mercado Público', fondos_gob: 'Fondos.gob.cl',
  }
  return map[f] ?? f
}

function estadoLabel(e: string) {
  return { abierto: 'Abierto', cerrado: 'Cerrado', por_abrir: 'Por abrir' }[e] ?? e
}

function montoLabel(m: string) {
  const map: Record<string, string> = {
    hasta_1M: 'Hasta $1M', '1M_10M': '$1M – $10M', '10M_30M': '$10M – $30M',
    '30M_60M': '$30M – $60M', '60M_100M': '$60M – $100M', sobre_100M: 'Más de $100M',
  }
  return map[m] ?? m
}

function alcanceLabel(a: string) {
  return { regional: 'Regional', nacional: 'Nacional', internacional: 'Internacional' }[a] ?? a
}

function formatFecha(f: string) {
  if (!f) return '—'
  return new Date(f).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function esUrgente(f: string) {
  if (!f) return false
  const dias = (new Date(f).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  return dias >= 0 && dias <= 7
}

const exportando = ref(false)

async function exportarCSV() {
  exportando.value = true
  const { data } = await buildQuery().range(0, 999).select('titulo, fuente, tipo, estado, monto_rango, fecha_cierre_postulacion, organizador, alcance, link_postulacion, url_original')
  if (!data?.length) { exportando.value = false; return }

  const cols = ['Título', 'Fuente', 'Tipo', 'Estado', 'Monto', 'Cierre', 'Organizador', 'Alcance', 'Link postulación', 'URL original']
  const rows = data.map(r => [
    r.titulo, fuenteLabel(r.fuente), r.tipo, r.estado,
    montoLabel(r.monto_rango ?? ''), r.fecha_cierre_postulacion ?? '',
    r.organizador ?? '', r.alcance ?? '',
    r.link_postulacion ?? '', r.url_original ?? '',
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))

  const csv = [cols.join(','), ...rows].join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `licitaciones-${new Date().toISOString().split('T')[0]}.csv`
  a.click(); URL.revokeObjectURL(url)
  exportando.value = false
}

async function toggleGuardado(id: string) {
  if (guardadosSet.value.has(id)) {
    await supabase.from('guardados').delete().eq('convocatoria_id', id)
    guardadosSet.value.delete(id)
    toast('Eliminado de guardados', 'info')
  } else {
    await supabase.from('guardados').insert({ convocatoria_id: id })
    guardadosSet.value.add(id)
    toast('Guardado correctamente')
  }
  guardadosSet.value = new Set(guardadosSet.value)
}

function saveScroll() {
  const el = document.querySelector('.main') as HTMLElement
  if (el) sessionStorage.setItem(SCROLL_KEY, el.scrollTop.toString())
}

function diasRestantes(f: string): number {
  return Math.ceil((new Date(f).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

onMounted(async () => {
  const semanaAtras = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [, { data: guardados }, { count: cNuevos }] = await Promise.all([
    loadPlan(),
    supabase.from('guardados').select('convocatoria_id'),
    supabase.from('convocatorias')
      .select('id', { count: 'exact', head: true })
      .eq('fuente', FUENTE)
      .gte('fecha_scrapeado', semanaAtras),
  ])
  guardadosSet.value = new Set((guardados ?? []).map((g: any) => g.convocatoria_id))
  nuevosEstaSemana.value = cNuevos ?? 0

  await cargar()

  const saved = sessionStorage.getItem(SCROLL_KEY)
  if (saved) {
    await nextTick()
    const el = document.querySelector('.main') as HTMLElement
    if (el) el.scrollTop = parseInt(saved)
    sessionStorage.removeItem(SCROLL_KEY)
  }
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.content { flex: 1; padding: 2rem 2.5rem; font-family: 'Inter', sans-serif; }

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  gap: 1rem;
}
h1 { font-size: 1.625rem; font-weight: 700; color: #0f172a; letter-spacing: -0.025em; }
.subtitle { font-size: 0.875rem; color: #64748b; margin-top: 0.2rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.badge-nuevos { font-size: 0.7rem; font-weight: 700; background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; padding: 0.1rem 0.5rem; border-radius: 999px; }

.btn-config {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  background: white;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #475569;
  text-decoration: none;
  transition: all 0.15s;
  white-space: nowrap;
  font-family: 'Inter', sans-serif;
}
.btn-config:hover { border-color: #0ea5e9; color: #0ea5e9; }
.btn-export-locked { color: #94a3b8; cursor: pointer; }
.btn-export-locked:hover { border-color: #6366f1; color: #6366f1; }
.btn-pro-tag {
  font-size: 0.55rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;
  background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white;
  padding: 0.1rem 0.35rem; border-radius: 4px; margin-left: 0.1rem;
}

/* Filtros */
.filtros {
  display: flex;
  flex-wrap: wrap;
  gap: 0.625rem;
  margin-bottom: 1rem;
}
.search-wrap {
  position: relative;
  flex: 1;
  min-width: 200px;
}
.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
  pointer-events: none;
}
.search-input {
  width: 100%;
  padding: 0.55rem 0.75rem 0.55rem 2.25rem;
  border: 1.5px solid #e2e8f0;
  border-radius: 9px;
  font-size: 0.875rem;
  font-family: inherit;
  color: #0f172a;
  outline: none;
  background: white;
  transition: border-color 0.15s;
}
.search-input:focus { border-color: #0ea5e9; }
.select {
  padding: 0.55rem 0.75rem;
  border: 1.5px solid #e2e8f0;
  border-radius: 9px;
  font-size: 0.875rem;
  font-family: inherit;
  color: #0f172a;
  background: white;
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s;
}
.select:focus { border-color: #0ea5e9; }
.btn-clear {
  padding: 0.55rem 0.875rem;
  background: none;
  border: 1.5px solid #e2e8f0;
  border-radius: 9px;
  font-size: 0.8125rem;
  font-family: inherit;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-clear:hover { border-color: #ef4444; color: #ef4444; }

/* Sort */
.sort-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}
.sort-label { font-size: 0.8125rem; color: #94a3b8; }
.sort-btn {
  padding: 0.3rem 0.75rem;
  border: 1.5px solid #e2e8f0;
  border-radius: 99px;
  font-size: 0.8rem;
  font-family: inherit;
  color: #64748b;
  background: white;
  cursor: pointer;
  transition: all 0.15s;
}
.sort-btn.active { border-color: #0ea5e9; color: #0ea5e9; background: #f0f9ff; }

/* Empty */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
  gap: 0.75rem;
}
.empty-icon {
  width: 56px; height: 56px;
  background: #f1f5f9;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.25rem;
}
.empty-title { font-size: 1rem; font-weight: 600; color: #0f172a; }
.empty-desc { font-size: 0.875rem; color: #64748b; }

/* Cards */
.lista { display: flex; flex-direction: column; gap: 0.75rem; }
.card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 1.25rem 1.5rem;
  transition: box-shadow 0.15s, border-color 0.15s;
}
.card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.06); border-color: #cbd5e1; }

.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.625rem;
  gap: 0.5rem;
}
.tags { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.card-top-right { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
.btn-guardar {
  background: none; border: none; cursor: pointer; padding: 2px;
  color: #cbd5e1; display: flex; align-items: center; transition: color 0.15s;
}
.btn-guardar:hover { color: #0ea5e9; }
.btn-guardar.guardado { color: #0ea5e9; }
.tag-fuente {
  font-size: 0.7rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; color: #0ea5e9;
}
.tag-tipo {
  font-size: 0.7rem; font-weight: 600;
  padding: 0.15rem 0.5rem; border-radius: 999px;
}
.tag-tipo.fondo { background: #f0fdf4; color: #16a34a; }
.tag-tipo.licitacion { background: #eef2ff; color: #4338ca; }

.badge-estado {
  font-size: 0.7rem; font-weight: 700;
  padding: 0.2rem 0.6rem; border-radius: 999px;
  letter-spacing: 0.03em; text-transform: uppercase;
  white-space: nowrap;
}
.badge-estado.abierto  { background: #f0fdf4; color: #16a34a; }
.badge-estado.cerrado  { background: #f1f5f9; color: #94a3b8; }
.badge-estado.por_abrir { background: #fefce8; color: #a16207; }

.card-title-link { text-decoration: none; }
.card-title-link:hover h3 { color: #0ea5e9; }
.card h3 { font-size: 0.9375rem; font-weight: 600; color: #0f172a; margin-bottom: 0.375rem; line-height: 1.4; transition: color 0.15s; }
.desc { font-size: 0.875rem; color: #64748b; line-height: 1.55; }

.card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 0.875rem;
}
.meta-item {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.8rem;
  color: #94a3b8;
  font-weight: 500;
}
.meta-item.urgente { color: #f59e0b; font-weight: 600; }

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1rem;
  padding-top: 0.875rem;
  border-top: 1px solid #f1f5f9;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.focos { display: flex; gap: 0.35rem; flex-wrap: wrap; }
.foco-tag {
  font-size: 0.7rem; font-weight: 500;
  padding: 0.2rem 0.5rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  color: #64748b;
}
.card-links { display: flex; gap: 0.75rem; align-items: center; }
.ver-link {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #94a3b8;
  text-decoration: none;
  transition: color 0.15s;
}
.ver-link:hover { color: #64748b; }
.ver-link.primary {
  color: #0ea5e9;
  background: #f0f9ff;
  padding: 0.35rem 0.75rem;
  border-radius: 8px;
  border: 1px solid #bae6fd;
}
.ver-link.primary:hover { background: #e0f2fe; }

/* Empty clear button */
.btn-empty-clear {
  margin-top: 0.5rem;
  padding: 0.5rem 1.25rem;
  background: white;
  border: 1.5px solid #e2e8f0;
  border-radius: 9px;
  font-size: 0.875rem;
  font-weight: 500;
  font-family: inherit;
  color: #475569;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-empty-clear:hover { border-color: #0ea5e9; color: #0ea5e9; }

/* Urgency chip */
.chip-urgente {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  background: #fff7ed;
  color: #c2410c;
  border: 1px solid #fed7aa;
}

/* Skeleton */
@keyframes shimmer {
  from { background-position: -600px 0; }
  to   { background-position: 600px 0; }
}
.sk-card { pointer-events: none; }
.sk-block {
  background: linear-gradient(90deg, #f1f5f9 25%, #e8edf3 50%, #f1f5f9 75%);
  background-size: 1200px 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 6px;
}
.sk-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.875rem; }
.sk-row { display: flex; gap: 0.5rem; }
.sk-tag { width: 58px; height: 14px; }
.sk-badge { width: 52px; height: 20px; border-radius: 999px; }
.sk-title { height: 18px; width: 70%; margin-bottom: 0.6rem; }
.sk-line { height: 13px; margin-bottom: 0.4rem; }
.sk-short { width: 50%; }
.sk-meta { display: flex; gap: 0.75rem; margin-top: 1rem; }
.sk-pill { width: 80px; height: 13px; border-radius: 999px; }

/* Load more */
.load-more { text-align: center; margin-top: 1.5rem; }
.btn-more {
  padding: 0.625rem 1.5rem;
  background: white;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 500;
  font-family: inherit;
  color: #475569;
  cursor: pointer;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}
.btn-more:hover { border-color: #0ea5e9; color: #0ea5e9; }

/* Spinners */
.spinner {
  width: 28px; height: 28px;
  border: 3px solid #e2e8f0;
  border-top-color: #0ea5e9;
  border-radius: 50%;
  animation: spin 0.65s linear infinite;
}
.spinner-sm {
  width: 14px; height: 14px;
  border: 2px solid #cbd5e1;
  border-top-color: #0ea5e9;
  border-radius: 50%;
  animation: spin 0.65s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 640px) {
  .content { padding: 1.5rem 1rem; }
  .filtros { flex-direction: column; }
  .select, .search-wrap { width: 100%; }
}
</style>
