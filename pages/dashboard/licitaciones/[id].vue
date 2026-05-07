<template>
  <NuxtLayout name="dashboard">
    <div class="content">

      <NuxtLink to="/dashboard/licitaciones" class="back-link">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        Volver a licitaciones
      </NuxtLink>

      <div v-if="loading" class="loading-wrap">
        <div class="spinner"></div>
      </div>

      <div v-else-if="!item" class="empty-wrap">
        <p>No se encontró la licitación.</p>
        <NuxtLink to="/dashboard/licitaciones" class="btn-primary">Ver licitaciones</NuxtLink>
      </div>

      <template v-else>
        <!-- Header -->
        <div class="hero">
          <div class="hero-tags">
            <img src="/sources/mercadopublico.png" alt="Mercado Público" class="source-logo-hero" />
            <span class="tag-fuente">Mercado Público</span>
            <span class="tag-tipo">Licitación</span>
            <span v-if="item.tipo_financiamiento" class="tag-financiamiento">{{ item.tipo_financiamiento }}</span>
          </div>
          <div class="hero-top">
            <h1>{{ item.titulo }}</h1>
            <span :class="['badge-estado', item.estado]">{{ estadoLabel(item.estado) }}</span>
          </div>
          <p v-if="item.organizador" class="organizador">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            {{ item.organizador }}
          </p>
        </div>

        <!-- Acciones -->
        <div class="acciones">
          <a :href="item.url_original" target="_blank" class="btn-portal">
            Ver en Mercado Público
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </a>
          <button :class="['btn-secundario', 'btn-guardar-detalle', guardado ? 'guardado' : '']" @click="toggleGuardado">
            <svg width="14" height="14" viewBox="0 0 24 24" :fill="guardado ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            {{ guardado ? 'Guardado' : 'Guardar' }}
          </button>
          <button :class="['btn-secundario', 'btn-oferte', ofertado ? 'ofertado' : '']" @click="toggleOfertado">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            {{ ofertado ? 'Ya ofertaste' : 'Marcar como ofertado' }}
          </button>
        </div>

        <div class="grid">

          <!-- Columna principal -->
          <div class="col-main">

            <!-- Descripción -->
            <section class="card-section" v-if="item.descripcion_breve">
              <h2>Objeto de la licitación</h2>
              <p class="descripcion">{{ item.descripcion_breve }}</p>
            </section>

            <!-- Categorías de ítems -->
            <section class="card-section" v-if="item.foco?.length">
              <h2>Categorías</h2>
              <div class="focos-wrap">
                <span v-for="f in item.foco" :key="f" class="foco-tag">{{ f }}</span>
              </div>
            </section>

          </div>

          <!-- Columna lateral -->
          <div class="col-side">

            <!-- Plazos -->
            <div class="side-card" v-if="item.fecha_cierre_postulacion || item.fecha_inicio_postulacion">
              <h3>Plazos</h3>
              <div class="side-rows">
                <div v-if="item.fecha_inicio_postulacion" class="side-row">
                  <span class="side-label">Publicación</span>
                  <span class="side-val">{{ formatFecha(item.fecha_inicio_postulacion) }}</span>
                </div>
                <div v-if="item.fecha_cierre_postulacion" class="side-row">
                  <span class="side-label">Cierre de ofertas</span>
                  <span :class="['side-val', esUrgente(item.fecha_cierre_postulacion) ? 'urgente' : '']">
                    {{ formatFecha(item.fecha_cierre_postulacion) }}
                    <span v-if="esUrgente(item.fecha_cierre_postulacion)" class="urgente-chip">¡Pronto!</span>
                  </span>
                </div>
                <div v-if="item.fecha_cierre_postulacion" class="side-row">
                  <span class="side-label">Días restantes</span>
                  <span :class="['side-val', esUrgente(item.fecha_cierre_postulacion) ? 'urgente' : '']">
                    {{ diasRestantes(item.fecha_cierre_postulacion) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Monto -->
            <div class="side-card" v-if="item.monto_maximo || item.monto_rango">
              <h3>Monto estimado</h3>
              <div class="side-rows">
                <div v-if="item.monto_maximo" class="side-row">
                  <span class="side-label">Valor referencial</span>
                  <span class="side-val monto-exacto">{{ formatMonto(item.monto_maximo) }}</span>
                </div>
                <div v-else-if="item.monto_rango" class="side-row">
                  <span class="side-label">Rango estimado</span>
                  <span class="side-val">{{ montoLabel(item.monto_rango) }}</span>
                </div>
              </div>
            </div>

            <!-- Organismo comprador -->
            <div class="side-card" v-if="item.alcance || item.region">
              <h3>Ubicación</h3>
              <div class="side-rows">
                <div v-if="item.region" class="side-row">
                  <span class="side-label">Región</span>
                  <span class="side-val">{{ item.region }}</span>
                </div>
                <div v-if="item.alcance" class="side-row">
                  <span class="side-label">Cobertura</span>
                  <span class="side-val">{{ alcanceLabel(item.alcance) }}</span>
                </div>
              </div>
            </div>

            <!-- Fuente -->
            <div class="side-card">
              <h3>Fuente</h3>
              <div class="side-rows">
                <div class="side-row">
                  <span class="side-label">Código</span>
                  <span class="side-val codigo">{{ codigoLicitacion(item.url_original) }}</span>
                </div>
                <div v-if="item.fecha_scrapeado" class="side-row">
                  <span class="side-label">Actualizado</span>
                  <span class="side-val">{{ formatFecha(item.fecha_scrapeado) }}</span>
                </div>
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
const route = useRoute()

const item    = ref<any>(null)
const loading = ref(true)
const guardado = ref(false)
const ofertado = ref(false)

onMounted(async () => {
  const id = route.params.id as string

  const [{ data }, { data: g }, { data: o }] = await Promise.all([
    supabase.from('convocatorias').select('*').eq('id', id).single(),
    supabase.from('guardados').select('id').eq('convocatoria_id', id).maybeSingle(),
    supabase.from('postulaciones').select('id').eq('convocatoria_id', id).maybeSingle(),
  ])

  item.value    = data
  guardado.value = !!g
  ofertado.value = !!o
  loading.value = false
})

async function toggleGuardado() {
  const id = route.params.id as string
  if (guardado.value) {
    await supabase.from('guardados').delete().eq('convocatoria_id', id)
    guardado.value = false
  } else {
    await supabase.from('guardados').insert({ convocatoria_id: id })
    guardado.value = true
  }
}

async function toggleOfertado() {
  const id = route.params.id as string
  if (ofertado.value) {
    await supabase.from('postulaciones').delete().eq('convocatoria_id', id)
    ofertado.value = false
  } else {
    await supabase.from('postulaciones').insert({ convocatoria_id: id })
    ofertado.value = true
  }
}

function codigoLicitacion(url: string): string {
  if (!url) return '—'
  const m = url.match(/[?&]qs=([^&]+)/)
  return m ? m[1] : '—'
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

function formatMonto(n: number) {
  if (!n) return '—'
  return '$' + n.toLocaleString('es-CL')
}

)
}

function esUrgente(f: string) {
  if (!f) return false
  const dias = (new Date(f).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  return dias >= 0 && dias <= 7
}

function diasRestantes(f: string) {
  if (!f) return '—'
  const dias = Math.ceil((new Date(f).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (dias < 0) return 'Cerrado'
  if (dias === 0) return 'Hoy'
  if (dias === 1) return '1 día'
  return `${dias} días`
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.content { flex: 1; padding: 2rem 2.5rem; font-family: 'Inter', sans-serif; max-width: 1100px; }

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #64748b;
  text-decoration: none;
  margin-bottom: 1.5rem;
  transition: color 0.15s;
}
.back-link:hover { color: #0f172a; }

.hero { margin-bottom: 1.25rem; }
.source-logo-hero { width: 48px; height: 48px; border-radius: 10px; object-fit: cover; flex-shrink: 0; }
.hero-tags { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
.hero-top {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}
h1 { font-size: 1.5rem; font-weight: 700; color: #0f172a; letter-spacing: -0.025em; line-height: 1.3; }

.organizador {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.875rem;
  color: #64748b;
  font-weight: 500;
}

.tag-fuente { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #6366f1; }
.tag-tipo {
  font-size: 0.7rem; font-weight: 600;
  padding: 0.15rem 0.5rem; border-radius: 999px;
  background: #eef2ff; color: #4338ca;
}
.tag-financiamiento {
  font-size: 0.7rem; font-weight: 600;
  padding: 0.15rem 0.5rem; border-radius: 999px;
  background: #f8fafc; color: #475569;
  border: 1px solid #e2e8f0;
}

.badge-estado {
  font-size: 0.7rem; font-weight: 700;
  padding: 0.25rem 0.7rem; border-radius: 999px;
  letter-spacing: 0.03em; text-transform: uppercase;
  white-space: nowrap; flex-shrink: 0;
}
.badge-estado.abierto  { background: #f0fdf4; color: #16a34a; }
.badge-estado.cerrado  { background: #f1f5f9; color: #94a3b8; }
.badge-estado.por_abrir { background: #fefce8; color: #a16207; }

.acciones { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 2rem; }

.btn-portal {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.625rem 1.25rem;
  background: #6366f1;
  color: white;
  font-size: 0.9rem;
  font-weight: 600;
  border-radius: 10px;
  text-decoration: none;
  transition: background 0.15s;
  font-family: 'Inter', sans-serif;
}
.btn-portal:hover { background: #4f46e5; }

.btn-secundario {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.625rem 1rem;
  background: white;
  border: 1.5px solid #e2e8f0;
  color: #475569;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 10px;
  text-decoration: none;
  transition: all 0.15s;
  font-family: 'Inter', sans-serif;
  cursor: pointer;
}
.btn-secundario:hover { border-color: #6366f1; color: #6366f1; }
.btn-guardar-detalle.guardado { border-color: #6366f1; color: #6366f1; background: #eef2ff; }
.btn-oferte.ofertado { border-color: #22c55e; color: #16a34a; background: #f0fdf4; }

.grid { display: grid; grid-template-columns: 1fr 280px; gap: 1.5rem; align-items: start; }

.card-section {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 1.5rem;
  margin-bottom: 1rem;
}
.card-section h2 {
  font-size: 0.875rem;
  font-weight: 700;
  color: #0f172a;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 1rem;
}
.descripcion { font-size: 0.9375rem; color: #334155; line-height: 1.7; }

.focos-wrap { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.foco-tag {
  font-size: 0.8rem; font-weight: 500;
  padding: 0.25rem 0.6rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  color: #64748b;
}

.col-side { display: flex; flex-direction: column; gap: 1rem; }
.side-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 1.25rem;
}
.side-card h3 {
  font-size: 0.75rem;
  font-weight: 700;
  color: #0f172a;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.875rem;
}
.side-rows { display: flex; flex-direction: column; gap: 0.625rem; }
.side-row { display: flex; flex-direction: column; gap: 0.15rem; }
.side-label { font-size: 0.75rem; color: #94a3b8; font-weight: 500; }
.side-val { font-size: 0.9rem; color: #334155; font-weight: 600; }
.side-val.urgente { color: #f59e0b; }
.monto-exacto { font-size: 1.05rem; font-weight: 800; color: #0f172a; }
.codigo { font-family: monospace; font-size: 0.85rem; color: #475569; }

.urgente-chip {
  display: inline-block;
  margin-left: 0.4rem;
  font-size: 0.65rem;
  font-weight: 700;
  background: #fef3c7;
  color: #b45309;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.loading-wrap { display: flex; justify-content: center; padding: 4rem; }
.empty-wrap { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 4rem; color: #64748b; font-size: 0.9rem; }
.btn-primary { padding: 0.625rem 1.25rem; background: #6366f1; color: white; font-size: 0.875rem; font-weight: 600; border-radius: 10px; text-decoration: none; }

.spinner { width: 28px; height: 28px; border: 3px solid #e2e8f0; border-top-color: #6366f1; border-radius: 50%; animation: spin 0.65s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 768px) {
  .content { padding: 1.5rem 1rem; }
  .grid { grid-template-columns: 1fr; }
  h1 { font-size: 1.25rem; }
}
</style>
