<template>
  <NuxtLayout name="dashboard">
    <div class="content">

      <div class="header">
        <div>
          <h1>Mis Match</h1>
          <p v-if="plan !== 'free'" class="subtitle">
            <template v-if="!loading && resultados.length">{{ resultados.length }} fondos analizados · ordenados por compatibilidad</template>
            <template v-else-if="!loading && perfilCompleto">Analizando tus fondos…</template>
            <template v-else-if="!loading">Configura tu proyecto para ver resultados</template>
            <template v-else>Cargando…</template>
          </p>
        </div>
        <div v-if="plan !== 'free'" class="header-actions">
          <!-- Selector de proyecto (cuando hay más de 1) -->
          <div v-if="proyectos.length > 1" class="proyecto-selector">
            <button
              v-for="p in proyectos"
              :key="p.id"
              :class="['proyecto-btn', selectedProyectoId === p.id ? 'active' : '']"
              @click="selectProyecto(p.id)"
            >{{ p.nombre }}</button>
          </div>
          <button class="btn-proyectos" @click="drawerOpen = true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            {{ proyectos.length ? 'Editar proyectos' : 'Crear proyecto' }}
          </button>
        </div>
      </div>

      <!-- Gate: perfil incompleto -->
      <div v-if="plan !== 'free' && !loading && !perfilCompleto" class="perfil-gate">
        <div class="perfil-gate-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <h2>Completa tu proyecto para ver el match</h2>
        <p>Para calcular tu compatibilidad con cada fondo necesitamos saber el tipo de postulante y la etapa de tu proyecto.</p>
        <button class="btn-completar" @click="drawerOpen = true">
          Configurar proyecto →
        </button>
      </div>

      <!-- ── UPGRADE GATE (solo plan free) ──────────────────────── -->
      <template v-if="plan === 'free'">
        <div class="upgrade-wrap">

          <div class="upgrade-card">
            <div class="upgrade-top">
              <span class="upgrade-plan-actual">Estás en el Plan Free</span>
              <div class="upgrade-icon-wrap">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </div>
              <h2 class="upgrade-title">Descubre exactamente qué fondos son para ti</h2>
              <p class="upgrade-desc">El Plan Free te avisa cuando se abren fondos. Desde el Plan Starter analizamos cada uno y te decimos si realmente calificas — con razones concretas — para que postules solo donde tienes posibilidades reales.</p>
            </div>

            <div class="upgrade-benefits">
              <div class="benefit-item">
                <span class="benefit-check">✓</span>
                <div>
                  <strong>Score de compatibilidad fondo a fondo</strong>
                  <p>Cada fondo abierto recibe un % de match con tu proyecto específico.</p>
                </div>
              </div>
              <div class="benefit-item">
                <span class="benefit-check">✓</span>
                <div>
                  <strong>Razones concretas de por qué calificas o no</strong>
                  <p>Acepta tu tipo de persona, tu etapa, tu sector — todo explicado en detalle.</p>
                </div>
              </div>
              <div class="benefit-item">
                <span class="benefit-check">✓</span>
                <div>
                  <strong>Resultados ordenados por compatibilidad</strong>
                  <p>Los fondos con mayor match aparecen primero. Sin filtros manuales.</p>
                </div>
              </div>
              <div class="benefit-item">
                <span class="benefit-check">✓</span>
                <div>
                  <strong>Ahorra horas leyendo bases</strong>
                  <p>El sistema lee los requisitos por ti y los contrasta con tu proyecto.</p>
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
              Mejora tu plan para ver tus resultados
            </div>
            <div class="preview-cards">
              <div class="preview-card">
                <div class="preview-badge preview-alto">87%<br><small>Alto match</small></div>
                <div class="preview-body">
                  <div class="preview-line wide"></div>
                  <div class="preview-line medium"></div>
                  <div class="preview-line short"></div>
                  <div class="preview-razones">
                    <div class="preview-razon green"></div>
                    <div class="preview-razon green"></div>
                    <div class="preview-razon gray"></div>
                  </div>
                </div>
              </div>
              <div class="preview-card">
                <div class="preview-badge preview-medio">64%<br><small>Match parcial</small></div>
                <div class="preview-body">
                  <div class="preview-line wide"></div>
                  <div class="preview-line medium"></div>
                  <div class="preview-line short"></div>
                  <div class="preview-razones">
                    <div class="preview-razon green"></div>
                    <div class="preview-razon yellow"></div>
                    <div class="preview-razon gray"></div>
                  </div>
                </div>
              </div>
              <div class="preview-card">
                <div class="preview-badge preview-bajo">31%<br><small>Bajo match</small></div>
                <div class="preview-body">
                  <div class="preview-line wide"></div>
                  <div class="preview-line medium"></div>
                  <div class="preview-line short"></div>
                  <div class="preview-razones">
                    <div class="preview-razon red"></div>
                    <div class="preview-razon gray"></div>
                    <div class="preview-razon gray"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </template>

      <!-- ── CONTENIDO PRO ──────────────────────────────────────── -->
      <template v-else-if="canUseMatch">

      <!-- Sin perfil suficiente -->
      <div v-if="!loading && !perfilCompleto" class="empty-state">
        <div class="empty-icon">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <p class="empty-title">Completa tu perfil primero</p>
        <p class="empty-desc">Necesitamos saber quién eres y en qué etapa está tu proyecto para calcular tu match con cada fondo.</p>
        <NuxtLink to="/dashboard/mi-perfil" class="btn-primary">Completar mi perfil</NuxtLink>
      </div>

      <!-- Loading skeleton -->
      <div v-else-if="loading" class="lista">
        <div v-for="i in 4" :key="i" class="match-card sk-card">
          <div class="sk-block sk-match-badge"></div>
          <div class="card-body">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">
              <div style="display:flex;gap:0.4rem">
                <div class="sk-block sk-tag"></div>
                <div class="sk-block sk-tag"></div>
              </div>
              <div class="sk-block sk-badge"></div>
            </div>
            <div class="sk-block sk-title"></div>
            <div class="sk-block sk-line"></div>
            <div class="sk-block sk-line sk-short"></div>
            <div style="display:flex;gap:0.75rem;margin-top:1rem">
              <div class="sk-block sk-pill"></div>
              <div class="sk-block sk-pill"></div>
              <div class="sk-block sk-pill"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Sin resultados -->
      <div v-else-if="resultados.length === 0" class="empty-state">
        <p class="empty-title">No encontramos fondos abiertos para analizar</p>
        <p class="empty-desc">Prueba ampliando los focos en tus alertas o vuelve más tarde.</p>
      </div>

      <!-- Resultados con match -->
      <template v-else>
        <!-- Resumen del perfil activo -->
        <div class="perfil-activo">
          <span class="perfil-label">Perfil activo:</span>
          <span v-if="proyecto.tipo_persona" class="perfil-chip">{{ proyecto.tipo_persona === 'natural' ? 'Persona Natural' : 'Persona Jurídica' }}</span>
          <span v-if="proyecto.estado_proyecto" class="perfil-chip">{{ estadoLabel(proyecto.estado_proyecto) }}</span>
          <span v-for="f in proyecto.foco.slice(0, 3)" :key="f" class="perfil-chip">{{ f }}</span>
          <span v-if="proyecto.foco.length > 3" class="perfil-chip">+{{ proyecto.foco.length - 3 }} focos</span>
          <button type="button" class="perfil-edit" @click="drawerOpen = true">Editar</button>
        </div>

        <div class="lista">
          <div v-for="r in resultados" :key="r.conv.id" class="match-card">

            <!-- Match badge -->
            <div :class="['match-badge', r.nivel]">
              <span class="match-pct">{{ r.score }}%</span>
              <span class="match-nivel">{{ nivelLabel(r.nivel) }}</span>
            </div>

            <!-- Card body -->
            <div class="card-body">
              <div class="card-top">
                <div class="card-source">
                  <img :src="`/sources/${r.conv.fuente}.png`" :alt="fuenteLabel(r.conv.fuente)" class="source-logo" @error="(e) => (e.target as HTMLImageElement).style.display='none'" />
                  <div class="tags">
                    <span class="tag-fuente">{{ fuenteLabel(r.conv.fuente) }}</span>
                    <span :class="['tag-tipo', r.conv.tipo]">{{ r.conv.tipo === 'fondo' ? 'Fondo' : 'Licitación' }}</span>
                  </div>
                </div>
                <span :class="['badge-estado', r.conv.estado]">{{ estadoConvLabel(r.conv.estado) }}</span>
              </div>

              <NuxtLink :to="`/dashboard/oportunidades/${r.conv.id}`" class="card-title-link">
                <h3>{{ r.conv.titulo }}</h3>
              </NuxtLink>
              <p class="desc">{{ r.conv.descripcion_breve }}</p>

              <!-- Razones -->
              <div class="razones">
                <div v-for="(rz, i) in razonesVisibles(r)" :key="i" :class="['razon', rz.tipo]">
                  <span class="razon-icon">{{ rz.tipo === 'positivo' ? '✓' : rz.tipo === 'negativo' ? '✗' : '·' }}</span>
                  {{ rz.texto }}
                </div>
                <button
                  v-if="r.razones.length > 3"
                  class="ver-razones"
                  @click="toggleExpandido(r.conv.id)"
                >
                  {{ expandidos.has(r.conv.id) ? 'Ver menos' : `Ver ${r.razones.length - 3} más` }}
                </button>
              </div>

              <!-- Meta + acciones -->
              <div class="card-footer">
                <div class="card-meta">
                  <span v-if="r.conv.monto_rango" class="meta-item">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    {{ montoLabel(r.conv.monto_rango) }}
                  </span>
                  <span v-if="r.conv.fecha_cierre_postulacion" class="meta-item" :class="{ urgente: esUrgente(r.conv.fecha_cierre_postulacion) }">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    Cierra {{ formatFecha(r.conv.fecha_cierre_postulacion) }}
                  </span>
                </div>
                <div class="card-links">
                  <a v-if="r.conv.link_postulacion" :href="r.conv.link_postulacion" target="_blank" class="ver-link primary">
                    Postular
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                  </a>
                  <NuxtLink :to="`/dashboard/oportunidades/${r.conv.id}`" class="ver-link">Ver detalle</NuxtLink>
                </div>
              </div>
            </div>

          </div>
        </div>
      </template>

      </template><!-- fin bloque pro -->

      <!-- Drawer de Mis Proyectos -->
      <Transition name="drawer">
        <div v-if="drawerOpen" class="drawer-overlay" @click.self="cerrarDrawer">
          <aside class="drawer" role="dialog" aria-label="Mis Proyectos">
            <div class="drawer-head">
              <div>
                <h2>Mis Proyectos</h2>
                <p>Edita tu perfil para refinar el match. Los cambios se aplican al cerrar.</p>
              </div>
              <button class="drawer-close" @click="cerrarDrawer" aria-label="Cerrar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div class="drawer-body">
              <ProyectosManager @saved="cambiosPendientes = true" @deleted="cambiosPendientes = true" />
            </div>
          </aside>
        </div>
      </Transition>

    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { calcularMatch, type Razon, type MatchResult } from '~/shared/match'

definePageMeta({ middleware: 'auth', layout: false })

const supabase = useSupabaseClient()
const { plan, canUseMatch, load: loadPlan } = usePlan()

interface Resultado extends MatchResult { conv: any }

// ── Estado ────────────────────────────────────────────────────────
const loading             = ref(true)
const resultados          = ref<Resultado[]>([])
const expandidos          = ref(new Set<string>())
const proyectos           = ref<any[]>([])
const selectedProyectoId  = ref<string | null>(null)
const drawerOpen          = ref(false)
const cambiosPendientes   = ref(false)

async function cerrarDrawer() {
  drawerOpen.value = false
  if (!cambiosPendientes.value) return
  cambiosPendientes.value = false
  // Recargar lista de proyectos y el match. Si el proyecto seleccionado fue
  // eliminado, caer al primero disponible.
  const { data } = await supabase
    .from('proyectos')
    .select('id, nombre, tipo_persona, estado_proyecto')
    .order('created_at', { ascending: true })
  proyectos.value = data ?? []
  const sigueVigente = proyectos.value.find(p => p.id === selectedProyectoId.value)
  const elegido = sigueVigente ?? proyectos.value.find(p => p.tipo_persona && p.estado_proyecto) ?? proyectos.value[0]
  if (elegido) {
    selectedProyectoId.value = elegido.id
    await loadMatch(elegido.id)
  } else {
    selectedProyectoId.value = null
    resultados.value = []
    proyecto.value = { tipo_persona: null, estado_proyecto: null, foco: [], alcance: [], monto_minimo: null }
  }
}

const proyecto = ref({
  tipo_persona:    null as string | null,
  estado_proyecto: null as string | null,
  foco:            [] as string[],
  alcance:         [] as string[],
  monto_minimo:    null as string | null,
})

const perfilCompleto = computed(() =>
  !!proyecto.value.tipo_persona && !!proyecto.value.estado_proyecto
)

// ── UI helpers ────────────────────────────────────────────────────
function toggleExpandido(id: string) {
  if (expandidos.value.has(id)) expandidos.value.delete(id)
  else expandidos.value.add(id)
  expandidos.value = new Set(expandidos.value) // trigger reactivity
}

function razonesVisibles(r: Resultado): Razon[] {
  return expandidos.value.has(r.conv.id) ? r.razones : r.razones.slice(0, 3)
}

// ── Label helpers ─────────────────────────────────────────────────
function nivelLabel(n: string) {
  return { alto: 'Alto match', medio: 'Match parcial', bajo: 'Bajo match' }[n] ?? n
}
function estadoLabel(e: string) {
  return { solo_idea: 'Solo idea', maqueta: 'Maqueta', prototipo: 'Prototipo', marcha_blanca: 'Marcha blanca', crecimiento: 'En crecimiento' }[e] ?? e
}
function estadoConvLabel(e: string) {
  return { abierto: 'Abierto', cerrado: 'Cerrado', por_abrir: 'Por abrir' }[e] ?? e
}
function fuenteLabel(f: string) {
  return { corfo: 'CORFO', sercotec: 'SERCOTEC', anid: 'ANID', mercadopublico: 'Mercado Público', fondos_gob: 'Fondos.gob.cl', incubadoras: 'Incubadoras', fondos_cultura: 'Fondos Cultura', santander_x: 'Santander X' }[f] ?? f
}
function montoLabel(m: string) {
  return { hasta_1M: 'Hasta $1M', '1M_10M': '$1M – $10M', '10M_30M': '$10M – $30M', '30M_60M': '$30M – $60M', '60M_100M': '$60M – $100M', sobre_100M: 'Más de $100M' }[m] ?? m
}
function esUrgente(f: string) {
  const dias = (new Date(f).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  return dias >= 0 && dias <= 7
}

// ── Carga de datos ────────────────────────────────────────────────
async function loadMatch(proyectoId: string) {
  loading.value = true
  resultados.value = []

  const { data: p } = await supabase
    .from('proyectos')
    .select('tipo_persona, estado_proyecto, foco, alcance, monto_minimo')
    .eq('id', proyectoId)
    .maybeSingle()

  proyecto.value = {
    tipo_persona:    p?.tipo_persona    ?? null,
    estado_proyecto: p?.estado_proyecto ?? null,
    foco:            p?.foco            ?? [],
    alcance:         p?.alcance         ?? [],
    monto_minimo:    p?.monto_minimo    ?? null,
  }

  if (!perfilCompleto.value) { loading.value = false; return }

  const hoy = new Date().toISOString().split('T')[0]
  let q = supabase
    .from('convocatorias')
    .select('id, titulo, descripcion_breve, fuente, tipo, estado, monto_rango, fecha_cierre_postulacion, link_postulacion, foco, alcance, perfil_tipo_persona, perfil_nivel_desarrollo, perfil_antiguedad_empresa, perfil_nivel_ventas, perfil_limite_edad')
    .eq('estado', 'abierto')
    .or(`fecha_cierre_postulacion.gte.${hoy},fecha_cierre_postulacion.is.null`)
    .order('fecha_scrapeado', { ascending: false })
    .limit(200)

  if (proyecto.value.foco.length > 0)
    q = (q as any).overlaps('foco', proyecto.value.foco)

  const { data: convs } = await q

  resultados.value = (convs ?? [])
    .map(conv => ({ conv, ...calcularMatch(proyecto.value, conv) }))
    .sort((a, b) => b.score - a.score)

  loading.value = false
}

async function selectProyecto(id: string) {
  if (selectedProyectoId.value === id) return
  selectedProyectoId.value = id
  await loadMatch(id)
}

onMounted(async () => {
  await loadPlan()
  if (plan.value === 'free') { loading.value = false; return }

  const { data } = await supabase
    .from('proyectos')
    .select('id, nombre, tipo_persona, estado_proyecto')
    .order('created_at', { ascending: true })

  proyectos.value = data ?? []
  loading.value = false

  // Preferir un proyecto con perfil completo (tipo_persona + estado_proyecto).
  // Esto evita que un proyecto legacy vacío bloquee el gate cuando el usuario
  // ya tiene otro proyecto correctamente configurado.
  const completo = proyectos.value.find(p => p.tipo_persona && p.estado_proyecto)
  const elegido  = completo ?? proyectos.value[0]
  if (elegido) {
    selectedProyectoId.value = elegido.id
    await loadMatch(elegido.id)
  }
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.content { flex: 1; padding: 2rem 2.5rem; font-family: 'Inter', sans-serif; }

.header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.header-actions { display: flex; align-items: center; gap: 0.625rem; flex-wrap: wrap; }

.btn-proyectos {
  display: inline-flex; align-items: center; gap: 0.4rem;
  padding: 0.4rem 0.875rem; background: white; color: #475569;
  font-size: 0.8125rem; font-weight: 600; font-family: inherit;
  border: 1.5px solid #e2e8f0; border-radius: 8px; cursor: pointer;
  transition: all 0.15s;
}
.btn-proyectos:hover { border-color: #0ea5e9; color: #0ea5e9; }

/* Drawer */
.drawer-overlay {
  position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45);
  display: flex; justify-content: flex-end; z-index: 1000;
}
.drawer {
  width: min(720px, 100%); height: 100%; background: #f8fafc;
  display: flex; flex-direction: column;
  box-shadow: -8px 0 24px rgba(15,23,42,0.12);
}
.drawer-head {
  display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;
  padding: 1.25rem 1.5rem; border-bottom: 1px solid #e2e8f0; background: white;
}
.drawer-head h2 { font-size: 1.0625rem; font-weight: 700; color: #0f172a; margin-bottom: 0.2rem; }
.drawer-head p { font-size: 0.8125rem; color: #64748b; max-width: 480px; line-height: 1.45; }
.drawer-close {
  width: 32px; height: 32px; flex-shrink: 0;
  border: 1px solid #e2e8f0; border-radius: 8px;
  background: white; color: #64748b; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.drawer-close:hover { color: #0f172a; border-color: #cbd5e1; }
.drawer-body { flex: 1; overflow-y: auto; padding: 1.5rem; }

.drawer-enter-active, .drawer-leave-active { transition: opacity 0.2s; }
.drawer-enter-active .drawer, .drawer-leave-active .drawer { transition: transform 0.25s ease; }
.drawer-enter-from, .drawer-leave-to { opacity: 0; }
.drawer-enter-from .drawer, .drawer-leave-to .drawer { transform: translateX(100%); }

@media (max-width: 720px) {
  .drawer { width: 100%; }
  .drawer-body { padding: 1rem; }
}

.proyecto-selector { display: flex; gap: 0.375rem; flex-wrap: wrap; flex-shrink: 0; }
.proyecto-btn {
  padding: 0.4rem 0.875rem; border-radius: 8px; border: 1.5px solid #e2e8f0;
  font-size: 0.8125rem; font-weight: 500; font-family: inherit;
  color: #64748b; background: white; cursor: pointer; transition: all 0.15s;
}
.proyecto-btn:hover { border-color: #0ea5e9; color: #0ea5e9; }
.proyecto-btn.active { border-color: #0ea5e9; background: #f0f9ff; color: #0284c7; font-weight: 600; }

.perfil-gate {
  display: flex; flex-direction: column; align-items: center;
  padding: 4rem 2rem; text-align: center; gap: 0.875rem;
  background: white; border: 1px solid #e2e8f0; border-radius: 16px;
}
.perfil-gate-icon {
  width: 64px; height: 64px; border-radius: 16px;
  background: #f0f9ff; display: flex; align-items: center; justify-content: center;
  color: #0ea5e9; margin-bottom: 0.25rem;
}
.perfil-gate h2 { font-size: 1.125rem; font-weight: 700; color: #0f172a; }
.perfil-gate p { font-size: 0.9rem; color: #64748b; max-width: 400px; line-height: 1.6; }
.btn-completar {
  display: inline-flex; align-items: center; margin-top: 0.5rem;
  padding: 0.625rem 1.5rem; background: #0ea5e9; color: white;
  font-size: 0.9rem; font-weight: 600; font-family: inherit; border: none;
  border-radius: 10px; text-decoration: none; cursor: pointer; transition: background 0.15s;
}
.btn-completar:hover { background: #0284c7; }
h1 { font-size: 1.625rem; font-weight: 700; color: #0f172a; letter-spacing: -0.025em; }
.subtitle { font-size: 0.875rem; color: #64748b; margin-top: 0.2rem; }

/* Perfil activo */
.perfil-activo {
  display: flex; align-items: center; flex-wrap: wrap; gap: 0.4rem;
  margin-bottom: 1.5rem; padding: 0.75rem 1rem;
  background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;
  font-size: 0.8125rem;
}
.perfil-label { font-weight: 600; color: #64748b; }
.perfil-chip { padding: 0.2rem 0.6rem; background: white; border: 1px solid #e2e8f0; border-radius: 999px; color: #374151; font-size: 0.775rem; font-weight: 500; }
.perfil-edit { margin-left: auto; font-size: 0.775rem; color: #0ea5e9; background: none; border: none; cursor: pointer; font-family: inherit; font-weight: 500; padding: 0; }
.perfil-edit:hover { text-decoration: underline; }

/* Empty states */
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 55vh; text-align: center; gap: 0.75rem; }
.empty-icon { width: 56px; height: 56px; background: #f1f5f9; border-radius: 14px; display: flex; align-items: center; justify-content: center; color: #94a3b8; }
.empty-title { font-size: 1rem; font-weight: 600; color: #0f172a; }
.empty-desc { font-size: 0.875rem; color: #64748b; max-width: 380px; line-height: 1.6; }
.btn-primary { margin-top: 0.5rem; padding: 0.625rem 1.25rem; background: #0ea5e9; color: white; font-size: 0.9rem; font-weight: 600; border-radius: 10px; text-decoration: none; transition: background 0.15s; }
.btn-primary:hover { background: #0284c7; }

/* Match cards */
.lista { display: flex; flex-direction: column; gap: 1rem; }

.match-card {
  display: flex; gap: 1rem; background: white;
  border: 1px solid #e2e8f0; border-radius: 14px;
  padding: 1.25rem 1.5rem; transition: box-shadow 0.15s, border-color 0.15s;
  align-items: flex-start;
}
.match-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.06); border-color: #cbd5e1; }

/* Match badge */
.match-badge {
  flex-shrink: 0; width: 72px; text-align: center;
  padding: 0.6rem 0.5rem; border-radius: 10px; border: 1.5px solid;
}
.match-badge.alto   { background: #f0fdf4; border-color: #86efac; }
.match-badge.medio  { background: #fefce8; border-color: #fde047; }
.match-badge.bajo   { background: #f8fafc; border-color: #e2e8f0; }

.match-pct {
  display: block; font-size: 1.375rem; font-weight: 800; letter-spacing: -0.03em; line-height: 1;
}
.match-badge.alto  .match-pct { color: #16a34a; }
.match-badge.medio .match-pct { color: #a16207; }
.match-badge.bajo  .match-pct { color: #94a3b8; }

.match-nivel {
  display: block; font-size: 0.6rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; margin-top: 0.2rem;
}
.match-badge.alto  .match-nivel { color: #16a34a; }
.match-badge.medio .match-nivel { color: #a16207; }
.match-badge.bajo  .match-nivel { color: #94a3b8; }

/* Card body */
.card-body { flex: 1; min-width: 0; }
.card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; gap: 0.5rem; }
.card-source { display: flex; align-items: center; gap: 0.625rem; }
.source-logo { width: 36px; height: 36px; border-radius: 8px; object-fit: cover; flex-shrink: 0; }
.tags { display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center; }
.tag-fuente { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #0ea5e9; }
.tag-tipo { font-size: 0.68rem; font-weight: 600; padding: 0.12rem 0.45rem; border-radius: 999px; }
.tag-tipo.fondo { background: #f0fdf4; color: #16a34a; }
.tag-tipo.licitacion { background: #eef2ff; color: #4338ca; }
.badge-estado { font-size: 0.68rem; font-weight: 700; padding: 0.18rem 0.55rem; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.03em; white-space: nowrap; }
.badge-estado.abierto   { background: #f0fdf4; color: #16a34a; }
.badge-estado.cerrado   { background: #f1f5f9; color: #94a3b8; }
.badge-estado.por_abrir { background: #fefce8; color: #a16207; }

.card-title-link { text-decoration: none; }
.card-title-link:hover h3 { color: #0ea5e9; }
h3 { font-size: 0.9375rem; font-weight: 600; color: #0f172a; margin-bottom: 0.3rem; line-height: 1.4; transition: color 0.15s; }
.desc { font-size: 0.875rem; color: #64748b; line-height: 1.55; margin-bottom: 0.875rem; }

/* Razones */
.razones { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 0.875rem; }
.razon { display: flex; align-items: flex-start; gap: 0.4rem; font-size: 0.8125rem; line-height: 1.4; }
.razon-icon { font-size: 0.75rem; font-weight: 700; flex-shrink: 0; margin-top: 0.1rem; }
.razon.positivo { color: #15803d; }
.razon.positivo .razon-icon { color: #16a34a; }
.razon.neutro   { color: #64748b; }
.razon.neutro   .razon-icon { color: #94a3b8; }
.razon.negativo { color: #b91c1c; }
.razon.negativo .razon-icon { color: #ef4444; }

.ver-razones { background: none; border: none; font-size: 0.775rem; color: #0ea5e9; cursor: pointer; padding: 0; font-family: inherit; font-weight: 500; text-align: left; margin-top: 0.1rem; }
.ver-razones:hover { text-decoration: underline; }

/* Footer */
.card-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 0.875rem; border-top: 1px solid #f1f5f9; gap: 0.75rem; flex-wrap: wrap; }
.card-meta { display: flex; flex-wrap: wrap; gap: 0.75rem; }
.meta-item { display: flex; align-items: center; gap: 0.3rem; font-size: 0.78rem; color: #94a3b8; font-weight: 500; }
.meta-item.urgente { color: #f59e0b; font-weight: 600; }
.card-links { display: flex; gap: 0.75rem; align-items: center; }
.ver-link { display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.8rem; font-weight: 600; color: #94a3b8; text-decoration: none; transition: color 0.15s; }
.ver-link:hover { color: #64748b; }
.ver-link.primary { color: #0ea5e9; background: #f0f9ff; padding: 0.3rem 0.7rem; border-radius: 7px; border: 1px solid #bae6fd; }
.ver-link.primary:hover { background: #e0f2fe; }

.spinner { width: 28px; height: 28px; border: 3px solid #e2e8f0; border-top-color: #0ea5e9; border-radius: 50%; animation: spin 0.65s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@keyframes shimmer { from { background-position: -600px 0; } to { background-position: 600px 0; } }
.sk-card { pointer-events: none; }
.sk-block { background: linear-gradient(90deg, #f1f5f9 25%, #e8edf3 50%, #f1f5f9 75%); background-size: 1200px 100%; animation: shimmer 1.5s infinite; border-radius: 6px; }
.sk-match-badge { width: 72px; height: 72px; border-radius: 12px; flex-shrink: 0; }
.sk-tag { width: 58px; height: 14px; }
.sk-badge { width: 52px; height: 20px; border-radius: 999px; }
.sk-title { height: 18px; width: 70%; margin-bottom: 0.6rem; }
.sk-line { height: 13px; margin-bottom: 0.4rem; }
.sk-short { width: 50%; }
.sk-pill { width: 80px; height: 13px; border-radius: 999px; }

/* ── Upgrade gate ────────────────────────────────────────────────── */
.upgrade-wrap { display: flex; flex-direction: column; gap: 2rem; max-width: 680px; }

.upgrade-card {
  background: white; border: 1px solid #e2e8f0; border-radius: 18px;
  padding: 2.5rem; box-shadow: 0 4px 24px rgba(0,0,0,0.06);
}
.upgrade-top { text-align: center; margin-bottom: 2rem; }
.upgrade-plan-actual {
  display: inline-block; font-size: 0.75rem; font-weight: 600; color: #64748b;
  background: #f1f5f9; border-radius: 999px; padding: 0.25rem 0.75rem; margin-bottom: 1.25rem;
}
.upgrade-icon-wrap {
  width: 64px; height: 64px; margin: 0 auto 1.25rem;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  border-radius: 18px; display: flex; align-items: center; justify-content: center; color: white;
}
.upgrade-title { font-size: 1.5rem; font-weight: 800; color: #0f172a; letter-spacing: -0.03em; margin-bottom: 0.75rem; line-height: 1.25; }
.upgrade-desc { font-size: 0.9375rem; color: #475569; line-height: 1.65; max-width: 480px; margin: 0 auto; }

.upgrade-benefits { display: flex; flex-direction: column; gap: 1.125rem; margin-bottom: 2rem; }
.benefit-item { display: flex; gap: 0.875rem; align-items: flex-start; }
.benefit-check {
  width: 24px; height: 24px; flex-shrink: 0;
  background: #f0fdf4; border-radius: 999px;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.75rem; font-weight: 800; color: #16a34a;
}
.benefit-item strong { display: block; font-size: 0.9rem; font-weight: 700; color: #0f172a; margin-bottom: 0.15rem; }
.benefit-item p { font-size: 0.8375rem; color: #64748b; line-height: 1.5; margin: 0; }

.upgrade-actions { display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; }
.btn-upgrade {
  display: inline-flex; align-items: center; gap: 0.5rem;
  padding: 0.75rem 1.75rem; background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white; font-size: 0.9375rem; font-weight: 700; border-radius: 12px;
  text-decoration: none; transition: opacity 0.15s; box-shadow: 0 4px 14px rgba(99,102,241,0.35);
}
.btn-upgrade:hover { opacity: 0.9; }
.btn-ver-planes {
  display: inline-flex; align-items: center; padding: 0.75rem 1.25rem;
  background: white; border: 1.5px solid #e2e8f0; color: #475569;
  font-size: 0.9rem; font-weight: 500; border-radius: 12px; text-decoration: none; transition: all 0.15s;
}
.btn-ver-planes:hover { border-color: #6366f1; color: #6366f1; }

/* Preview borrosa */
.preview-wrap { position: relative; border-radius: 14px; overflow: hidden; }
.preview-cards { display: flex; flex-direction: column; gap: 0.75rem; filter: blur(3px); pointer-events: none; user-select: none; }
.preview-card {
  display: flex; gap: 1rem; background: white; border: 1px solid #e2e8f0;
  border-radius: 14px; padding: 1.25rem 1.5rem; align-items: flex-start;
}
.preview-badge {
  flex-shrink: 0; width: 68px; padding: 0.5rem; border-radius: 10px; border: 1.5px solid;
  text-align: center; font-size: 1.25rem; font-weight: 800; line-height: 1.1;
}
.preview-badge small { font-size: 0.55rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; display: block; margin-top: 0.2rem; }
.preview-alto   { background: #f0fdf4; border-color: #86efac; color: #16a34a; }
.preview-medio  { background: #fefce8; border-color: #fde047; color: #a16207; }
.preview-bajo   { background: #f8fafc; border-color: #e2e8f0; color: #94a3b8; }

.preview-body { flex: 1; }
.preview-line { height: 10px; background: #e2e8f0; border-radius: 999px; margin-bottom: 8px; }
.preview-line.wide   { width: 90%; }
.preview-line.medium { width: 65%; }
.preview-line.short  { width: 40%; }
.preview-razones { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
.preview-razon { height: 8px; width: 70%; border-radius: 999px; }
.preview-razon.green  { background: #bbf7d0; }
.preview-razon.yellow { background: #fde68a; }
.preview-razon.red    { background: #fecaca; }
.preview-razon.gray   { background: #e2e8f0; }

.preview-overlay {
  position: absolute; inset: 0; z-index: 10;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 0.6rem; font-size: 0.9rem; font-weight: 600; color: #475569;
  background: linear-gradient(to bottom, rgba(248,250,252,0.3) 0%, rgba(248,250,252,0.92) 60%, #f8fafc 100%);
}

@media (max-width: 640px) {
  .match-card { flex-direction: column; }
  .match-badge { width: 100%; display: flex; align-items: center; gap: 0.5rem; }
  .match-pct { font-size: 1.125rem; }
  .content { padding: 1.5rem 1rem; }
  .upgrade-card { padding: 1.5rem; }
  .upgrade-title { font-size: 1.25rem; }
}
</style>
