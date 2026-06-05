<template>
  <NuxtLayout name="dashboard">
    <div class="content">
      <div class="header">
        <div>
          <h1>Mis Postulaciones</h1>
          <p class="subtitle">Gestiona el ciclo completo: desde "voy a postular" hasta el resultado</p>
        </div>
        <div class="resumen-chips" v-if="!loading && items.length > 0">
          <span class="chip">Total: <strong>{{ items.length }}</strong></span>
          <span class="chip ok" v-if="conteoPorEstado.aprobada > 0">
            ✓ Aprobadas: <strong>{{ conteoPorEstado.aprobada }}</strong>
          </span>
          <span class="chip warn" v-if="conteoPorEstado.postulada > 0">
            En espera: <strong>{{ conteoPorEstado.postulada }}</strong>
          </span>
        </div>
      </div>

      <!-- Aviso upgrade (free / starter) -->
      <div v-if="!loading && !canUseKanban" class="upgrade-bar">
        <div class="upgrade-bar-text">
          <strong>El tablero kanban está en Advanced</strong>
          <span>Mover tarjetas entre etapas y vista en columnas. Mientras tanto, podés ver y administrar tus postulaciones acá abajo.</span>
        </div>
        <NuxtLink to="/planes" class="btn-upgrade">Mejorar a Advanced →</NuxtLink>
      </div>

      <!-- Skeleton -->
      <div v-if="loading" class="kanban">
        <div v-for="i in 5" :key="i" class="col">
          <div class="col-header sk-block" style="height:18px"></div>
          <div v-for="j in 2" :key="j" class="sk-card sk-block" style="height:90px;border-radius:10px"></div>
        </div>
      </div>

      <!-- Empty -->
      <div v-else-if="items.length === 0" class="empty">
        <div class="empty-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        </div>
        <p class="empty-title">Sin postulaciones registradas</p>
        <p class="empty-desc">Cuando marques un fondo como postulado, va a aparecer acá. Después podés moverlo entre estados según avance.</p>
        <NuxtLink to="/dashboard" class="btn-primary">Ver oportunidades</NuxtLink>
      </div>

      <!-- Lista plana (free / starter) -->
      <div v-else-if="!canUseKanban" class="lista">
        <template v-for="col in ESTADOS" :key="col.value">
          <section v-if="itemsPorEstado[col.value]?.length" class="lista-grupo" :class="col.value">
            <div class="lista-grupo-header">
              <span class="col-emoji">{{ col.emoji }}</span>
              <span class="col-title">{{ col.label }}</span>
              <span class="col-count">{{ itemsPorEstado[col.value].length }}</span>
            </div>
            <div
              v-for="item in itemsPorEstado[col.value]"
              :key="item.convocatoria_id"
              class="card lista-card"
            >
              <div class="card-top">
                <span class="tag-fuente">{{ fuenteLabel(item.fuente) }}</span>
                <button class="btn-remove" @click="quitar(item.convocatoria_id)" title="Quitar registro">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              <NuxtLink :to="`/dashboard/oportunidades/${item.convocatoria_id}`" class="card-title-link">
                <h3>{{ item.titulo }}</h3>
              </NuxtLink>

              <div class="card-meta" v-if="item.fecha_cierre_postulacion || item.monto_rango">
                <span v-if="item.monto_rango" class="meta-item">
                  {{ montoLabel(item.monto_rango) }}
                </span>
                <span v-if="item.fecha_cierre_postulacion" class="meta-item" :class="{ urgente: esUrgente(item.fecha_cierre_postulacion) }">
                  Cierra {{ formatFechaCorta(item.fecha_cierre_postulacion) }}
                </span>
              </div>

              <textarea
                v-model="item.notas"
                class="notas-input"
                placeholder="Agregar nota…"
                rows="1"
                @blur="guardarNotas(item)"
              ></textarea>

              <select :value="item.estado" @change="cambiarEstado(item, ($event.target as HTMLSelectElement).value)" class="select-estado">
                <option v-for="e in ESTADOS" :key="e.value" :value="e.value">
                  Mover a: {{ e.label }}
                </option>
              </select>
            </div>
          </section>
        </template>
      </div>

      <!-- Kanban (advanced / agency) -->
      <div v-else class="kanban">
        <div
          v-for="col in ESTADOS"
          :key="col.value"
          class="col"
          :class="[col.value, { 'col-over': dragOverCol === col.value }]"
          @dragover.prevent="dragOverCol = col.value"
          @dragleave="dragOverCol = dragOverCol === col.value ? null : dragOverCol"
          @drop.prevent="onDrop($event, col.value)"
        >
          <div class="col-header">
            <span class="col-emoji">{{ col.emoji }}</span>
            <span class="col-title">{{ col.label }}</span>
            <span class="col-count">{{ itemsPorEstado[col.value]?.length ?? 0 }}</span>
          </div>

          <div class="col-cards">
            <div v-if="!itemsPorEstado[col.value]?.length" class="col-empty">Arrastrá aquí</div>

            <div
              v-for="item in itemsPorEstado[col.value] ?? []"
              :key="item.convocatoria_id"
              class="card"
              :class="{ 'card-dragging': draggingId === item.convocatoria_id }"
              draggable="true"
              @dragstart="onDragStart($event, item)"
              @dragend="onDragEnd"
            >
              <div class="card-top">
                <span class="tag-fuente">{{ fuenteLabel(item.fuente) }}</span>
                <button class="btn-remove" @click="quitar(item.convocatoria_id)" title="Quitar registro">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              <NuxtLink :to="`/dashboard/oportunidades/${item.convocatoria_id}`" class="card-title-link">
                <h3>{{ item.titulo }}</h3>
              </NuxtLink>

              <div class="card-meta" v-if="item.fecha_cierre_postulacion || item.monto_rango">
                <span v-if="item.monto_rango" class="meta-item">
                  {{ montoLabel(item.monto_rango) }}
                </span>
                <span v-if="item.fecha_cierre_postulacion" class="meta-item" :class="{ urgente: esUrgente(item.fecha_cierre_postulacion) }">
                  Cierra {{ formatFechaCorta(item.fecha_cierre_postulacion) }}
                </span>
              </div>

              <textarea
                v-model="item.notas"
                class="notas-input"
                placeholder="Agregar nota…"
                rows="1"
                @blur="guardarNotas(item)"
              ></textarea>

              <div class="card-actions">
                <select :value="item.estado" @change="cambiarEstado(item, ($event.target as HTMLSelectElement).value)" class="select-estado">
                  <option v-for="e in ESTADOS" :key="e.value" :value="e.value">
                    Mover a: {{ e.label }}
                  </option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: false })

const supabase = useSupabaseClient()
const { show: toast } = useToast()
const { plan, load: loadPlan } = usePlan()
const canUseKanban = computed(() => plan.value === 'advanced' || plan.value === 'agency')
const items       = ref<any[]>([])
const loading     = ref(true)
const draggingId  = ref<string | null>(null)
const dragOverCol = ref<string | null>(null)

const ESTADOS = [
  { value: 'por_postular',   label: 'Por postular',    emoji: '📌' },
  { value: 'en_preparacion', label: 'En preparación',  emoji: '✍️' },
  { value: 'postulada',      label: 'Postulada',       emoji: '📤' },
  { value: 'aprobada',       label: 'Aprobada',        emoji: '🎉' },
  { value: 'rechazada',      label: 'Rechazada',       emoji: '🙁' },
] as const

type EstadoValue = typeof ESTADOS[number]['value']

const itemsPorEstado = computed(() => {
  const map: Record<string, any[]> = {}
  for (const e of ESTADOS) map[e.value] = []
  for (const it of items.value) {
    const key = (it.estado as EstadoValue) ?? 'postulada'
    if (map[key]) map[key].push(it)
  }
  return map
})

const conteoPorEstado = computed(() => Object.fromEntries(
  ESTADOS.map(e => [e.value, itemsPorEstado.value[e.value]?.length ?? 0])
))

onMounted(async () => {
  await loadPlan()
  const { data: posts } = await supabase
    .from('postulaciones')
    .select('convocatoria_id, postulado_at, notas, estado')
    .order('postulado_at', { ascending: false })

  if (!posts?.length) { loading.value = false; return }

  const ids = posts.map(p => p.convocatoria_id)
  const { data: convs } = await supabase
    .from('convocatorias')
    .select('id, titulo, fuente, tipo, monto_rango, fecha_cierre_postulacion, link_postulacion')
    .in('id', ids)

  const map = Object.fromEntries((convs ?? []).map(c => [c.id, c]))
  items.value = posts
    .map(p => ({
      ...map[p.convocatoria_id],
      convocatoria_id: p.convocatoria_id,
      postulado_at:    p.postulado_at,
      notas:           p.notas ?? '',
      estado:          p.estado ?? 'postulada',
    }))
    .filter(i => i.titulo)
  loading.value = false
})

function onDragStart(e: DragEvent, item: any) {
  draggingId.value = item.convocatoria_id
  if (e.dataTransfer) {
    e.dataTransfer.setData('text/plain', item.convocatoria_id)
    e.dataTransfer.effectAllowed = 'move'
  }
}
function onDragEnd() {
  draggingId.value  = null
  dragOverCol.value = null
}
function onDrop(e: DragEvent, nuevoEstado: string) {
  dragOverCol.value = null
  const id = e.dataTransfer?.getData('text/plain') || draggingId.value
  if (!id) return
  const item = items.value.find(i => i.convocatoria_id === id)
  if (!item || item.estado === nuevoEstado) return
  cambiarEstado(item, nuevoEstado)
}

async function cambiarEstado(item: any, nuevo: string) {
  if (item.estado === nuevo) return
  const { error } = await supabase
    .from('postulaciones')
    .update({ estado: nuevo })
    .eq('convocatoria_id', item.convocatoria_id)
  if (error) { toast('No se pudo actualizar', 'error'); return }
  item.estado = nuevo
  const label = ESTADOS.find(e => e.value === nuevo)?.label
  toast(`Movida a "${label}"`)
}

async function guardarNotas(item: any) {
  const { error } = await supabase
    .from('postulaciones')
    .update({ notas: item.notas })
    .eq('convocatoria_id', item.convocatoria_id)
  if (error) toast('No se pudo guardar la nota', 'error')
}

async function quitar(convocatoriaId: string) {
  if (!confirm('¿Quitar esta postulación del registro?')) return
  await supabase.from('postulaciones').delete().eq('convocatoria_id', convocatoriaId)
  items.value = items.value.filter(i => i.convocatoria_id !== convocatoriaId)
  toast('Postulación eliminada', 'info')
}

function fuenteLabel(f: string) {
  return { corfo: 'CORFO', sercotec: 'SERCOTEC', anid: 'ANID', mercadopublico: 'MP', fondos_gob: 'Fondos.gob', incubadoras: 'Incubadoras', fondos_cultura: 'Cultura', santander_x: 'Santander X' }[f] ?? f
}
function montoLabel(m: string) {
  return { hasta_1M: 'Hasta $1M', '1M_10M': '$1M–$10M', '10M_30M': '$10M–$30M', '30M_60M': '$30M–$60M', '60M_100M': '$60M–$100M', sobre_100M: '+$100M' }[m] ?? m
}
function formatFechaCorta(f: string) {
  return new Date(f).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
}
function esUrgente(f: string) {
  if (!f) return false
  const dias = (new Date(f).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  return dias >= 0 && dias <= 7
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.content { flex: 1; padding: 2rem 2.5rem; font-family: 'Inter', sans-serif; }
.header {
  display: flex; align-items: flex-start; justify-content: space-between;
  margin-bottom: 1.5rem; gap: 1rem; flex-wrap: wrap;
}
h1 { font-size: 1.625rem; font-weight: 700; color: #0f172a; letter-spacing: -0.025em; }
.subtitle { font-size: 0.875rem; color: #64748b; margin-top: 0.2rem; }

.resumen-chips { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
.chip {
  font-size: 0.8rem; padding: 0.3rem 0.7rem; border-radius: 999px;
  background: #f1f5f9; color: #475569; font-weight: 500;
}
.chip strong { color: #0f172a; }
.chip.ok    { background: #f0fdf4; color: #15803d; }
.chip.warn  { background: #fefce8; color: #a16207; }

/* Empty */
.empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 5rem 2rem; text-align: center; gap: 0.75rem; }
.empty-icon { width: 56px; height: 56px; background: #f1f5f9; border-radius: 14px; display: flex; align-items: center; justify-content: center; }
.empty-title { font-size: 1rem; font-weight: 600; color: #0f172a; }
.empty-desc { font-size: 0.875rem; color: #64748b; max-width: 380px; line-height: 1.55; }
.btn-primary { margin-top: 0.5rem; padding: 0.625rem 1.25rem; background: #0ea5e9; color: white; font-size: 0.875rem; font-weight: 600; border-radius: 10px; text-decoration: none; }

/* Kanban */
.kanban {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.75rem;
  align-items: start;
}
.col {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 0.875rem;
  min-height: 200px;
  display: flex; flex-direction: column; gap: 0.625rem;
}
.col-header { display: flex; align-items: center; gap: 0.4rem; padding-bottom: 0.5rem; border-bottom: 1px solid #e2e8f0; font-size: 0.85rem; font-weight: 700; color: #475569; }
.col-emoji { font-size: 1rem; }
.col-title { flex: 1; }
.col-count { background: white; border-radius: 999px; padding: 0.1rem 0.55rem; font-size: 0.72rem; font-weight: 700; color: #94a3b8; border: 1px solid #e2e8f0; }
.col.por_postular   .col-emoji { filter: hue-rotate(0); }
.col.aprobada       { border-color: #bbf7d0; background: #f0fdf4; }
.col.aprobada       .col-header { border-color: #bbf7d0; color: #15803d; }
.col.rechazada      .col-header { color: #94a3b8; }

.col-cards { display: flex; flex-direction: column; gap: 0.5rem; }
.col-empty { font-size: 0.78rem; color: #cbd5e1; padding: 0.5rem 0; text-align: center; }

.card {
  background: white; border: 1px solid #e2e8f0; border-radius: 10px;
  padding: 0.75rem 0.875rem; display: flex; flex-direction: column; gap: 0.5rem;
  transition: box-shadow 0.15s, border-color 0.15s, opacity 0.15s;
  cursor: grab;
}
.card:active { cursor: grabbing; }
.card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.05); border-color: #cbd5e1; }
.card-dragging { opacity: 0.4; }
.col-over { background: #e0f2fe; border-color: #7dd3fc; }
.col-over .col-empty { color: #0284c7; font-weight: 600; }

.card-top { display: flex; justify-content: space-between; align-items: center; }
.tag-fuente { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #0ea5e9; }
.btn-remove { background: none; border: none; color: #cbd5e1; cursor: pointer; padding: 2px; display: flex; align-items: center; border-radius: 4px; transition: color 0.15s; }
.btn-remove:hover { color: #ef4444; }

.card-title-link { text-decoration: none; }
.card-title-link h3 { font-size: 0.8rem; font-weight: 600; color: #0f172a; line-height: 1.35; transition: color 0.15s; }
.card-title-link:hover h3 { color: #0ea5e9; }

.card-meta { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.meta-item { font-size: 0.7rem; color: #94a3b8; font-weight: 500; }
.meta-item.urgente { color: #f59e0b; font-weight: 600; }

.notas-input {
  width: 100%; resize: none; min-height: 32px;
  border: 1px solid #f1f5f9; border-radius: 6px;
  padding: 0.4rem 0.5rem; font-size: 0.75rem; font-family: inherit; color: #475569;
  background: #fafbfc;
}
.notas-input:focus { outline: none; border-color: #bae6fd; background: white; }

.select-estado {
  width: 100%; padding: 0.35rem 0.5rem; border-radius: 6px;
  border: 1px solid #e2e8f0; background: white; font-size: 0.72rem; color: #475569;
  font-family: inherit; cursor: pointer;
}

/* Lista (free / starter) */
.upgrade-bar {
  display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;
  background: linear-gradient(135deg, #eef2ff, #ede9fe);
  border: 1px solid #c7d2fe; border-radius: 12px;
  padding: 0.875rem 1.125rem; margin-bottom: 1.25rem;
}
.upgrade-bar-text { display: flex; flex-direction: column; gap: 0.15rem; min-width: 220px; }
.upgrade-bar-text strong { font-size: 0.9rem; font-weight: 700; color: #312e81; }
.upgrade-bar-text span { font-size: 0.8rem; color: #4f46e5; }
.upgrade-bar .btn-upgrade {
  background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white;
  padding: 0.55rem 1rem; border-radius: 8px; font-size: 0.8rem; font-weight: 700;
  text-decoration: none; white-space: nowrap;
}
.upgrade-bar .btn-upgrade:hover { filter: brightness(1.05); }

.lista { display: flex; flex-direction: column; gap: 1.25rem; }
.lista-grupo { display: flex; flex-direction: column; gap: 0.625rem; }
.lista-grupo-header {
  display: flex; align-items: center; gap: 0.5rem;
  font-size: 0.85rem; font-weight: 700; color: #475569;
  padding-bottom: 0.4rem; border-bottom: 1px solid #e2e8f0;
}
.lista-grupo.aprobada .lista-grupo-header { color: #15803d; border-color: #bbf7d0; }
.lista-grupo.rechazada .lista-grupo-header { color: #94a3b8; }
.lista-card { max-width: 520px; }

/* Skeleton */
@keyframes shimmer { from { background-position: -600px 0; } to { background-position: 600px 0; } }
.sk-block { background: linear-gradient(90deg, #f1f5f9 25%, #e8edf3 50%, #f1f5f9 75%); background-size: 1200px 100%; animation: shimmer 1.5s infinite; border-radius: 6px; }
.sk-card { pointer-events: none; }

@media (max-width: 1100px) {
  .kanban { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 720px) {
  .kanban { grid-template-columns: 1fr; }
  .content { padding: 1.5rem 1rem; }
}
</style>
