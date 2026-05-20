<template>
  <NuxtLayout name="dashboard">
    <div class="content">

      <div class="header">
        <div>
          <h1>Comparador</h1>
          <p class="subtitle">Hasta 3 fondos lado a lado para decidir cuál priorizar</p>
        </div>
      </div>

      <!-- Gate Free -->
      <template v-if="plan === 'free'">
        <div class="upgrade-wrap">
          <div class="upgrade-card">
            <div class="upgrade-top">
              <span class="upgrade-plan-actual">Estás en el Plan Free</span>
              <h2 class="upgrade-title">Compará fondos antes de elegir</h2>
              <p class="upgrade-desc">Seleccionás 2 o 3 oportunidades y las ves lado a lado: requisitos, monto, foco, cierre. Ideal para priorizar tu tiempo.</p>
            </div>
            <div class="upgrade-actions">
              <NuxtLink to="/planes" class="btn-upgrade">Mejorar a Plan Starter →</NuxtLink>
            </div>
          </div>
        </div>
      </template>

      <!-- Starter+ -->
      <template v-else>

        <!-- Buscador / selección -->
        <div class="search-wrap">
          <div class="search-input-wrap">
            <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              v-model="search"
              type="text"
              placeholder="Buscar fondos abiertos por título…"
              class="search-input"
              :disabled="selected.length >= MAX"
            />
            <span v-if="searching" class="spinner-mini"></span>
          </div>
          <span class="selected-count">{{ selected.length }} / {{ MAX }} seleccionados</span>
          <button v-if="selected.length" class="btn-clear" @click="limpiar">Limpiar</button>
        </div>

        <!-- Resultados de búsqueda -->
        <div v-if="search.trim().length >= 2 && results.length" class="results-list">
          <div
            v-for="r in results"
            :key="r.id"
            class="result-row"
            :class="{ selected: isSelected(r.id), disabled: !isSelected(r.id) && selected.length >= MAX }"
            @click="toggle(r)"
          >
            <span class="result-fuente">{{ fuenteLabel(r.fuente) }}</span>
            <span class="result-titulo">{{ r.titulo }}</span>
            <span v-if="isSelected(r.id)" class="result-check">✓</span>
            <span v-else-if="selected.length >= MAX" class="result-disabled-text">Quitá uno para agregar</span>
          </div>
        </div>
        <div v-else-if="search.trim().length >= 2 && !searching && !results.length" class="results-empty">
          Sin resultados para "{{ search }}".
        </div>

        <!-- Empty state -->
        <div v-if="!selected.length" class="empty">
          <div class="empty-icon">⚖️</div>
          <p class="empty-title">Buscá hasta 3 fondos para compararlos</p>
          <p class="empty-desc">Usá el buscador de arriba. Después los vas a ver lado a lado con todos sus datos relevantes.</p>
        </div>

        <!-- Comparación -->
        <div v-else class="compare-grid" :style="{ gridTemplateColumns: `200px repeat(${selected.length}, minmax(0, 1fr))` }">
          <!-- Header row: nombres -->
          <div class="cell-row-label cell-header">Campo</div>
          <div v-for="item in selected" :key="`h-${item.id}`" class="cell-header">
            <button class="cell-remove" @click="remove(item.id)" title="Quitar">✕</button>
            <div class="cell-fuente">{{ fuenteLabel(item.fuente) }}</div>
            <div class="cell-titulo">{{ item.titulo }}</div>
          </div>

          <!-- Match score (si Pro con perfil) -->
          <template v-if="hayMatchPerfil">
            <div class="cell-row-label">Compatibilidad con tu proyecto</div>
            <div v-for="item in selected" :key="`m-${item.id}`" class="cell">
              <span :class="['match-badge', matchOf(item).nivel]">
                {{ matchOf(item).score }}% <small>· {{ nivelLabel(matchOf(item).nivel) }}</small>
              </span>
            </div>
          </template>

          <!-- Tipo -->
          <div class="cell-row-label">Tipo</div>
          <div v-for="item in selected" :key="`t-${item.id}`" class="cell">
            <span class="tag-tipo" :class="item.tipo">{{ item.tipo === 'fondo' ? 'Fondo' : 'Licitación' }}</span>
          </div>

          <!-- Organizador -->
          <div class="cell-row-label">Organizador</div>
          <div v-for="item in selected" :key="`o-${item.id}`" class="cell">{{ item.organizador ?? '—' }}</div>

          <!-- Monto -->
          <div class="cell-row-label">Monto</div>
          <div v-for="item in selected" :key="`mo-${item.id}`" class="cell">
            <strong>{{ montoLabel(item.monto_rango) }}</strong>
          </div>

          <!-- Alcance -->
          <div class="cell-row-label">Alcance</div>
          <div v-for="item in selected" :key="`a-${item.id}`" class="cell">{{ alcanceLabel(item.alcance) }}</div>

          <!-- Cierre -->
          <div class="cell-row-label">Cierra</div>
          <div v-for="item in selected" :key="`c-${item.id}`" class="cell">
            <span v-if="item.fecha_cierre_postulacion" :class="{ urgente: esUrgente(item.fecha_cierre_postulacion) }">
              {{ formatFecha(item.fecha_cierre_postulacion) }}
              <small v-if="esUrgente(item.fecha_cierre_postulacion)">¡Pronto!</small>
            </span>
            <span v-else>—</span>
          </div>

          <!-- Foco -->
          <div class="cell-row-label">Foco</div>
          <div v-for="item in selected" :key="`f-${item.id}`" class="cell">
            <div class="chip-list">
              <span v-for="f in (item.foco ?? [])" :key="f" class="chip">{{ f }}</span>
              <span v-if="!item.foco?.length" class="muted">—</span>
            </div>
          </div>

          <!-- Tipo de persona -->
          <div class="cell-row-label">Tipo de persona</div>
          <div v-for="item in selected" :key="`tp-${item.id}`" class="cell">
            <div class="chip-list">
              <span v-for="t in (item.perfil_tipo_persona ?? [])" :key="t" class="chip">{{ t }}</span>
              <span v-if="!item.perfil_tipo_persona?.length" class="muted">—</span>
            </div>
          </div>

          <!-- Nivel desarrollo -->
          <div class="cell-row-label">Etapa requerida</div>
          <div v-for="item in selected" :key="`nd-${item.id}`" class="cell">{{ item.perfil_nivel_desarrollo ?? '—' }}</div>

          <!-- Antigüedad -->
          <div class="cell-row-label">Antigüedad</div>
          <div v-for="item in selected" :key="`an-${item.id}`" class="cell">{{ item.perfil_antiguedad_empresa ?? '—' }}</div>

          <!-- Nivel ventas -->
          <div class="cell-row-label">Nivel de ventas</div>
          <div v-for="item in selected" :key="`nv-${item.id}`" class="cell">{{ item.perfil_nivel_ventas ?? '—' }}</div>

          <!-- Acciones -->
          <div class="cell-row-label"></div>
          <div v-for="item in selected" :key="`l-${item.id}`" class="cell cell-actions">
            <NuxtLink :to="`/dashboard/oportunidades/${item.id}`" class="link-action">Ver detalle</NuxtLink>
            <a v-if="item.link_postulacion" :href="item.link_postulacion" target="_blank" class="link-action primary">Postular →</a>
          </div>
        </div>

      </template>
    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { calcularMatch, type Perfil, type MatchResult } from '~/shared/match'

definePageMeta({ middleware: 'auth', layout: false })

const supabase = useSupabaseClient()
const { plan, load: loadPlan } = usePlan()

const MAX = 3
const search    = ref('')
const searching = ref(false)
const results   = ref<any[]>([])
const selected  = ref<any[]>([])
const perfilUsuario = ref<Perfil | null>(null)
const matchCache    = ref<Record<string, MatchResult>>({})

const hayMatchPerfil = computed(() =>
  !!perfilUsuario.value?.tipo_persona && !!perfilUsuario.value?.estado_proyecto
)

function isSelected(id: string) { return selected.value.some(s => s.id === id) }
function matchOf(item: any): MatchResult {
  if (matchCache.value[item.id]) return matchCache.value[item.id]
  if (!perfilUsuario.value) return { score: 0, nivel: 'bajo', razones: [] }
  const m = calcularMatch(perfilUsuario.value, item)
  matchCache.value[item.id] = m
  return m
}

function toggle(item: any) {
  if (isSelected(item.id)) {
    selected.value = selected.value.filter(s => s.id !== item.id)
  } else if (selected.value.length < MAX) {
    selected.value = [...selected.value, item]
  }
  persistSelection()
  // Al llegar al tope, limpiamos la búsqueda para que la tabla quede visible
  // inmediatamente sin tener que scrollear por encima de la lista de resultados.
  if (selected.value.length >= MAX) {
    search.value  = ''
    results.value = []
  }
}
function remove(id: string) {
  selected.value = selected.value.filter(s => s.id !== id)
  persistSelection()
}
function limpiar() {
  selected.value = []
  search.value   = ''
  results.value  = []
  persistSelection()
}

function persistSelection() {
  try {
    const ids = selected.value.map(s => s.id)
    localStorage.setItem('comparador_selected', JSON.stringify(ids))
  } catch {}
}

// Debounced search
let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(search, (q) => {
  if (searchTimer) clearTimeout(searchTimer)
  if (!q || q.trim().length < 2) { results.value = []; return }
  searching.value = true
  searchTimer = setTimeout(async () => {
    const hoy = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('convocatorias')
      .select('id, titulo, fuente, tipo, organizador, monto_rango, alcance, foco, fecha_cierre_postulacion, link_postulacion, perfil_tipo_persona, perfil_nivel_desarrollo, perfil_antiguedad_empresa, perfil_nivel_ventas')
      .eq('estado', 'abierto')
      .or(`fecha_cierre_postulacion.gte.${hoy},fecha_cierre_postulacion.is.null`)
      .ilike('titulo', `%${q.trim()}%`)
      .limit(15)
    results.value  = data ?? []
    searching.value = false
  }, 250)
})

onMounted(async () => {
  await loadPlan()
  if (plan.value === 'free') return

  // Cargar perfil del usuario para mostrar match
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: proy } = await supabase
      .from('proyectos')
      .select('tipo_persona, estado_proyecto, foco, alcance, monto_minimo')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (proy) {
      perfilUsuario.value = {
        tipo_persona:    (proy as any).tipo_persona    ?? null,
        estado_proyecto: (proy as any).estado_proyecto ?? null,
        foco:            (proy as any).foco            ?? [],
        alcance:         (proy as any).alcance         ?? [],
        monto_minimo:    (proy as any).monto_minimo    ?? null,
      }
    }
  }

  // Restaurar selección de localStorage
  try {
    const raw = localStorage.getItem('comparador_selected')
    const ids = raw ? JSON.parse(raw) : []
    if (Array.isArray(ids) && ids.length) {
      const { data } = await supabase
        .from('convocatorias')
        .select('id, titulo, fuente, tipo, organizador, monto_rango, alcance, foco, fecha_cierre_postulacion, link_postulacion, perfil_tipo_persona, perfil_nivel_desarrollo, perfil_antiguedad_empresa, perfil_nivel_ventas')
        .in('id', ids.slice(0, MAX))
      // Preservar orden original
      const map = Object.fromEntries((data ?? []).map(c => [c.id, c]))
      selected.value = ids.map((id: string) => map[id]).filter(Boolean)
    }
  } catch {}
})

// Labels
const FUENTE: Record<string, string> = { corfo: 'CORFO', sercotec: 'SERCOTEC', anid: 'ANID', mercadopublico: 'Mercado Público', fondos_gob: 'Fondos.gob.cl', incubadoras: 'Incubadoras', fondos_cultura: 'Fondos Cultura' }
function fuenteLabel(f: string) { return FUENTE[f] ?? f }
function montoLabel(m: string | null | undefined) {
  if (!m) return '—'
  return { hasta_1M: 'Hasta $1M', '1M_10M': '$1M – $10M', '10M_30M': '$10M – $30M', '30M_60M': '$30M – $60M', '60M_100M': '$60M – $100M', sobre_100M: 'Más de $100M' }[m] ?? m
}
function alcanceLabel(a: string | null | undefined) {
  if (!a) return '—'
  return ({ regional: 'Regional', nacional: 'Nacional', internacional: 'Internacional' } as Record<string, string>)[a] ?? a
}
function nivelLabel(n: string) {
  return ({ alto: 'Alto match', medio: 'Match parcial', bajo: 'Bajo match' } as Record<string, string>)[n] ?? n
}
function formatFecha(f: string) {
  return new Date(f).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
}
function esUrgente(f: string | null | undefined) {
  if (!f) return false
  const dias = (new Date(f).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  return dias >= 0 && dias <= 7
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.content { flex: 1; padding: 2rem 2.5rem; font-family: 'Inter', sans-serif; }

.header { margin-bottom: 1.5rem; }
h1 { font-size: 1.625rem; font-weight: 700; color: #0f172a; letter-spacing: -0.025em; }
.subtitle { font-size: 0.875rem; color: #64748b; margin-top: 0.25rem; }

/* Buscador */
.search-wrap {
  display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem;
  background: white; border: 1px solid #e2e8f0; border-radius: 12px;
  padding: 0.75rem 1rem; flex-wrap: wrap;
}
.search-input-wrap { flex: 1; position: relative; min-width: 240px; }
.search-icon { position: absolute; left: 0.5rem; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none; }
.search-input {
  width: 100%; padding: 0.5rem 0.5rem 0.5rem 2rem; border-radius: 8px;
  border: 1px solid transparent; font-size: 0.9rem; font-family: inherit;
  background: #f8fafc; color: #0f172a;
}
.search-input:focus { outline: none; border-color: #bae6fd; background: white; }
.search-input:disabled { opacity: 0.5; cursor: not-allowed; }
.spinner-mini { position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%); width: 14px; height: 14px; border: 2px solid #e2e8f0; border-top-color: #0ea5e9; border-radius: 50%; animation: spin 0.7s linear infinite; }
.selected-count { font-size: 0.78rem; color: #64748b; font-weight: 600; }
.btn-clear { background: none; border: 1px solid #e2e8f0; color: #64748b; padding: 0.4rem 0.9rem; border-radius: 8px; font-size: 0.78rem; font-weight: 600; cursor: pointer; font-family: inherit; }
.btn-clear:hover { border-color: #ef4444; color: #ef4444; }

/* Resultados de búsqueda */
.results-list { background: white; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 1rem; overflow: hidden; }
.result-row { display: flex; align-items: center; gap: 0.75rem; padding: 0.625rem 1rem; cursor: pointer; border-bottom: 1px solid #f1f5f9; transition: background 0.12s; }
.result-row:last-child { border-bottom: none; }
.result-row:hover { background: #f8fafc; }
.result-row.selected { background: #f0f9ff; }
.result-row.disabled { opacity: 0.5; cursor: not-allowed; }
.result-fuente { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; color: #0ea5e9; min-width: 90px; letter-spacing: 0.05em; }
.result-titulo { flex: 1; font-size: 0.85rem; color: #0f172a; }
.result-check { color: #0ea5e9; font-weight: 700; }
.result-disabled-text { font-size: 0.72rem; color: #f59e0b; }
.results-empty { padding: 1rem; text-align: center; font-size: 0.85rem; color: #94a3b8; }

/* Empty */
.empty { display: flex; flex-direction: column; align-items: center; padding: 4rem 2rem; text-align: center; gap: 0.5rem; }
.empty-icon { font-size: 2.5rem; margin-bottom: 0.5rem; }
.empty-title { font-size: 1rem; font-weight: 600; color: #0f172a; }
.empty-desc { font-size: 0.85rem; color: #64748b; max-width: 420px; line-height: 1.55; }

/* Comparación */
.compare-grid {
  display: grid; gap: 1px; background: #e2e8f0;
  border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;
  background-color: #e2e8f0;
}
.compare-grid > * { background: white; padding: 0.75rem 1rem; font-size: 0.85rem; color: #334155; }
.cell-row-label { background: #f8fafc; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; display: flex; align-items: center; }
.cell-header { background: #0f172a; color: white; padding: 1rem; position: relative; }
.cell-header.cell-row-label { background: #0f172a; color: white; }
.cell-fuente { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #7dd3fc; margin-bottom: 0.25rem; }
.cell-titulo { font-size: 0.85rem; font-weight: 700; line-height: 1.35; }
.cell-remove { position: absolute; top: 0.5rem; right: 0.5rem; background: rgba(255,255,255,0.1); color: white; border: none; width: 22px; height: 22px; border-radius: 50%; cursor: pointer; font-size: 0.85rem; font-family: inherit; }
.cell-remove:hover { background: #ef4444; }
.cell { min-height: 48px; }
.cell-actions { display: flex; flex-direction: column; gap: 0.4rem; align-items: flex-start; }
.urgente { color: #f59e0b; font-weight: 600; }
.urgente small { background: #fef3c7; color: #a16207; padding: 0.1rem 0.4rem; border-radius: 999px; font-size: 0.65rem; font-weight: 700; margin-left: 0.3rem; }
.muted { color: #cbd5e1; }

.chip-list { display: flex; flex-wrap: wrap; gap: 0.3rem; }
.chip { font-size: 0.7rem; padding: 0.15rem 0.5rem; border-radius: 999px; background: #f1f5f9; color: #475569; }
.tag-tipo { font-size: 0.7rem; font-weight: 600; padding: 0.15rem 0.55rem; border-radius: 999px; }
.tag-tipo.fondo { background: #f0fdf4; color: #16a34a; }
.tag-tipo.licitacion { background: #eef2ff; color: #4338ca; }

.match-badge { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.25rem 0.6rem; border-radius: 999px; font-weight: 700; font-size: 0.8rem; }
.match-badge small { font-weight: 500; opacity: 0.8; }
.match-badge.alto  { background: #f0fdf4; color: #15803d; }
.match-badge.medio { background: #fefce8; color: #a16207; }
.match-badge.bajo  { background: #fef2f2; color: #dc2626; }

.link-action { font-size: 0.78rem; font-weight: 600; color: #475569; text-decoration: none; }
.link-action:hover { color: #0ea5e9; }
.link-action.primary { color: white; background: #0ea5e9; padding: 0.3rem 0.7rem; border-radius: 6px; }
.link-action.primary:hover { background: #0284c7; }

/* Upgrade gate */
.upgrade-wrap { max-width: 600px; }
.upgrade-card { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 2.5rem; }
.upgrade-top { text-align: center; margin-bottom: 2rem; }
.upgrade-plan-actual { display: inline-block; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #64748b; background: #f1f5f9; padding: 0.25rem 0.75rem; border-radius: 999px; margin-bottom: 1.25rem; }
.upgrade-title { font-size: 1.375rem; font-weight: 800; color: #0f172a; margin-bottom: 0.75rem; }
.upgrade-desc { font-size: 0.95rem; color: #64748b; line-height: 1.65; }
.upgrade-actions { display: flex; justify-content: center; }
.btn-upgrade { display: inline-flex; align-items: center; background: #0ea5e9; color: white; padding: 0.75rem 1.5rem; border-radius: 10px; font-weight: 700; text-decoration: none; }
.btn-upgrade:hover { background: #0284c7; }

@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 900px) {
  .compare-grid { grid-template-columns: 1fr !important; }
  .cell-header { padding: 1rem; }
  .content { padding: 1.5rem 1rem; }
}
</style>
