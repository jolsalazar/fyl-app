<template>
  <NuxtLayout name="dashboard">
    <div class="content">
      <div class="header">
        <div>
          <h1>Mis Postulaciones</h1>
          <p class="subtitle">Fondos y licitaciones donde ya postulaste</p>
        </div>
      </div>

      <div v-if="loading" class="empty">
        <div class="spinner"></div>
      </div>

      <div v-else-if="items.length === 0" class="empty">
        <div class="empty-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        </div>
        <p class="empty-title">Sin postulaciones registradas</p>
        <p class="empty-desc">Cuando postules a un fondo, márcalo aquí para llevar el registro. Aparece el botón "Ya postulé" en cada oportunidad.</p>
        <NuxtLink to="/dashboard" class="btn-primary">Ver oportunidades</NuxtLink>
      </div>

      <div v-else class="lista">
        <div v-for="item in items" :key="item.convocatoria_id" class="card">
          <div class="card-top">
            <div class="tags">
              <span class="tag-fuente">{{ fuenteLabel(item.fuente) }}</span>
              <span class="tag-tipo" :class="item.tipo">{{ item.tipo === 'fondo' ? 'Fondo' : 'Licitación' }}</span>
            </div>
            <div class="card-right">
              <span :class="['badge-estado', item.estado]">{{ estadoLabel(item.estado) }}</span>
              <span class="badge-postule">✓ Postulé</span>
              <button class="btn-remove" @click="quitar(item.convocatoria_id)" title="Quitar registro">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>

          <NuxtLink :to="`/dashboard/oportunidades/${item.convocatoria_id}`" class="card-title-link">
            <h3>{{ item.titulo }}</h3>
          </NuxtLink>
          <p class="desc">{{ item.descripcion_breve }}</p>

          <div class="card-meta">
            <span class="meta-item meta-postule">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Postulé el {{ formatFecha(item.postulado_at) }}
            </span>
            <span v-if="item.monto_rango" class="meta-item">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              {{ montoLabel(item.monto_rango) }}
            </span>
            <span v-if="item.fecha_cierre_postulacion" class="meta-item" :class="{ urgente: esUrgente(item.fecha_cierre_postulacion) }">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Cierra {{ formatFecha(item.fecha_cierre_postulacion) }}
            </span>
          </div>

          <div class="card-footer">
            <div class="focos">
              <span v-for="f in (item.foco ?? []).slice(0, 3)" :key="f" class="foco-tag">{{ f }}</span>
            </div>
            <div class="card-links">
              <a v-if="item.link_postulacion" :href="item.link_postulacion" target="_blank" class="ver-link primary">
                Ir a postulación
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </a>
              <NuxtLink :to="`/dashboard/oportunidades/${item.convocatoria_id}`" class="ver-link">Ver detalle</NuxtLink>
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
const items    = ref<any[]>([])
const loading  = ref(true)

onMounted(async () => {
  const { data: posts } = await supabase
    .from('postulaciones')
    .select('convocatoria_id, postulado_at, notas')
    .order('postulado_at', { ascending: false })

  if (!posts?.length) { loading.value = false; return }

  const ids = posts.map(p => p.convocatoria_id)
  const { data: convs } = await supabase
    .from('convocatorias')
    .select('id, titulo, descripcion_breve, fuente, tipo, estado, monto_rango, fecha_cierre_postulacion, link_postulacion, foco')
    .in('id', ids)

  const map = Object.fromEntries((convs ?? []).map(c => [c.id, c]))
  items.value = posts
    .map(p => ({ ...map[p.convocatoria_id], convocatoria_id: p.convocatoria_id, postulado_at: p.postulado_at }))
    .filter(i => i.titulo)
  loading.value = false
})

async function quitar(convocatoriaId: string) {
  await supabase.from('postulaciones').delete().eq('convocatoria_id', convocatoriaId)
  items.value = items.value.filter(i => i.convocatoria_id !== convocatoriaId)
}

function fuenteLabel(f: string) {
  return { corfo: 'CORFO', sercotec: 'SERCOTEC', anid: 'ANID', mercadopublico: 'Mercado Público', fondos_gob: 'Fondos.gob.cl' }[f] ?? f
}
function estadoLabel(e: string) {
  return { abierto: 'Abierto', cerrado: 'Cerrado', por_abrir: 'Por abrir' }[e] ?? e
}
function montoLabel(m: string) {
  return { hasta_1M: 'Hasta $1M', '1M_10M': '$1M – $10M', '10M_30M': '$10M – $30M', '30M_60M': '$30M – $60M', '60M_100M': '$60M – $100M', sobre_100M: 'Más de $100M' }[m] ?? m
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
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.content { flex: 1; padding: 2rem 2.5rem; font-family: 'Inter', sans-serif; }
.header { margin-bottom: 1.75rem; }
h1 { font-size: 1.625rem; font-weight: 700; color: #0f172a; letter-spacing: -0.025em; }
.subtitle { font-size: 0.875rem; color: #64748b; margin-top: 0.2rem; }

.empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 5rem 2rem; text-align: center; gap: 0.75rem; }
.empty-icon { width: 56px; height: 56px; background: #f1f5f9; border-radius: 14px; display: flex; align-items: center; justify-content: center; }
.empty-title { font-size: 1rem; font-weight: 600; color: #0f172a; }
.empty-desc { font-size: 0.875rem; color: #64748b; max-width: 380px; line-height: 1.55; }
.btn-primary { margin-top: 0.5rem; padding: 0.625rem 1.25rem; background: #0ea5e9; color: white; font-size: 0.875rem; font-weight: 600; border-radius: 10px; text-decoration: none; }

.lista { display: flex; flex-direction: column; gap: 0.75rem; }
.card { background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1.25rem 1.5rem; transition: box-shadow 0.15s, border-color 0.15s; border-left: 3px solid #22c55e; }
.card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.06); border-color: #86efac; }

.card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.625rem; gap: 0.5rem; flex-wrap: wrap; }
.tags { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.card-right { display: flex; align-items: center; gap: 0.5rem; }

.tag-fuente { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #0ea5e9; }
.tag-tipo { font-size: 0.7rem; font-weight: 600; padding: 0.15rem 0.5rem; border-radius: 999px; }
.tag-tipo.fondo { background: #f0fdf4; color: #16a34a; }
.tag-tipo.licitacion { background: #eef2ff; color: #4338ca; }

.badge-estado { font-size: 0.7rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 999px; letter-spacing: 0.03em; text-transform: uppercase; white-space: nowrap; }
.badge-estado.abierto   { background: #f0fdf4; color: #16a34a; }
.badge-estado.cerrado   { background: #f1f5f9; color: #94a3b8; }
.badge-estado.por_abrir { background: #fefce8; color: #a16207; }

.badge-postule { font-size: 0.7rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 999px; background: #f0fdf4; color: #16a34a; border: 1px solid #86efac; white-space: nowrap; }

.btn-remove { background: none; border: none; color: #cbd5e1; cursor: pointer; padding: 2px; display: flex; align-items: center; border-radius: 4px; transition: color 0.15s; }
.btn-remove:hover { color: #ef4444; }

.card-title-link { text-decoration: none; }
.card-title-link:hover h3 { color: #0ea5e9; }
.card h3 { font-size: 0.9375rem; font-weight: 600; color: #0f172a; margin-bottom: 0.375rem; line-height: 1.4; transition: color 0.15s; }
.desc { font-size: 0.875rem; color: #64748b; line-height: 1.55; }

.card-meta { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.875rem; }
.meta-item { display: flex; align-items: center; gap: 0.3rem; font-size: 0.8rem; color: #94a3b8; font-weight: 500; }
.meta-item.urgente { color: #f59e0b; font-weight: 600; }
.meta-postule { color: #16a34a; font-weight: 600; }

.card-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; padding-top: 0.875rem; border-top: 1px solid #f1f5f9; gap: 0.75rem; flex-wrap: wrap; }
.focos { display: flex; gap: 0.35rem; flex-wrap: wrap; }
.foco-tag { font-size: 0.7rem; font-weight: 500; padding: 0.2rem 0.5rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; color: #64748b; }
.card-links { display: flex; gap: 0.75rem; align-items: center; }
.ver-link { display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.8125rem; font-weight: 600; color: #94a3b8; text-decoration: none; transition: color 0.15s; }
.ver-link:hover { color: #64748b; }
.ver-link.primary { color: #0ea5e9; background: #f0f9ff; padding: 0.35rem 0.75rem; border-radius: 8px; border: 1px solid #bae6fd; }
.ver-link.primary:hover { background: #e0f2fe; }

.spinner { width: 28px; height: 28px; border: 3px solid #e2e8f0; border-top-color: #0ea5e9; border-radius: 50%; animation: spin 0.65s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
