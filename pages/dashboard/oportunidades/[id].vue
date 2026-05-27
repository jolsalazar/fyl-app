<template>
  <NuxtLayout name="dashboard">
    <div class="content">

      <!-- Back -->
      <NuxtLink to="/dashboard" class="back-link">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        Volver al listado
      </NuxtLink>

      <div v-if="loading" class="loading-wrap">
        <div class="spinner"></div>
      </div>

      <div v-else-if="!item" class="empty-wrap">
        <p>No se encontró la convocatoria.</p>
        <NuxtLink to="/dashboard" class="btn-primary">Ver oportunidades</NuxtLink>
      </div>

      <template v-else>
        <!-- Header -->
        <div class="hero">
          <div class="hero-tags">
            <img :src="`/sources/${item.fuente}.png`" :alt="fuenteLabel(item.fuente)" class="source-logo-hero" @error="(e) => (e.target as HTMLImageElement).style.display='none'" />
            <span class="tag-fuente">{{ fuenteLabel(item.fuente) }}</span>
            <span :class="['tag-tipo', item.tipo]">{{ item.tipo === 'fondo' ? 'Fondo' : 'Licitación' }}</span>
            <span v-if="item.tipo_financiamiento" class="tag-financiamiento">{{ item.tipo_financiamiento }}</span>
          </div>
          <div class="hero-top">
            <h1>{{ item.titulo }}</h1>
            <span :class="['badge-estado', item.estado]">{{ estadoLabel(item.estado) }}</span>
          </div>
          <div class="organizador-wrap">
            <p v-if="item.organizador" class="organizador">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              {{ item.organizador }}
            </p>
            <span v-if="edicionesAnteriores > 0" class="chip-recurrente">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
              Fondo recurrente · {{ edicionesAnteriores }} edición{{ edicionesAnteriores !== 1 ? 'es' : '' }} anterior{{ edicionesAnteriores !== 1 ? 'es' : '' }}
            </span>
          </div>
        </div>

        <!-- Acciones principales -->
        <div class="acciones">
          <a v-if="item.link_postulacion" :href="item.link_postulacion" target="_blank" class="btn-postular">
            Postular
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </a>
          <a v-if="item.link_bases" :href="item.link_bases" target="_blank" class="btn-secundario">
            Ver bases
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
          <a v-if="item.url_original" :href="item.url_original" target="_blank" class="btn-secundario">
            Fuente original
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
          <button :class="['btn-secundario', 'btn-guardar-detalle', guardado ? 'guardado' : '']" @click="toggleGuardado">
            <svg width="14" height="14" viewBox="0 0 24 24" :fill="guardado ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            {{ guardado ? 'Guardado' : 'Guardar' }}
            <span v-if="totalGuardados >= 2" class="guardados-count">{{ totalGuardados }}</span>
          </button>
          <button :class="['btn-secundario', 'btn-postule', postulado ? 'postulado' : '']" @click="togglePostulado">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            {{ postulado ? 'Ya postulé' : 'Marcar como postulado' }}
          </button>
        </div>

        <div class="grid">

          <!-- Columna principal -->
          <div class="col-main">

            <!-- Descripción -->
            <section class="card-section" v-if="item.descripcion_breve">
              <h2>Descripción</h2>
              <div class="descripcion">
                <p v-for="(linea, i) in descripcionLineas" :key="i">{{ linea }}</p>
              </div>
            </section>

            <!-- Requisitos clave -->
            <section class="card-section" v-if="item.requisitos_clave?.length">
              <h2>Requisitos para postular</h2>
              <ul class="requisitos-lista">
                <li v-for="r in item.requisitos_clave" :key="r" class="requisito-item">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  {{ r }}
                </li>
              </ul>
            </section>

            <!-- Documentación requerida -->
            <section class="card-section" v-if="item.documentacion_requerida?.length">
              <h2>Documentación a presentar</h2>
              <ul class="requisitos-lista">
                <li v-for="d in item.documentacion_requerida" :key="d" class="requisito-item">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  <a v-if="parseDoc(d).href" :href="parseDoc(d).href!" target="_blank" rel="noopener" class="doc-link">{{ parseDoc(d).label }}</a>
                  <span v-else>{{ parseDoc(d).label }}</span>
                </li>
              </ul>
            </section>

            <!-- Perfil requerido -->
            <section class="card-section" v-if="tienePerfilRequerido">
              <h2>Perfil requerido</h2>
              <div class="perfil-grid">
                <div v-if="item.perfil_tipo_persona?.length" class="perfil-item">
                  <span class="perfil-label">Tipo de persona</span>
                  <div class="perfil-tags">
                    <span v-for="t in item.perfil_tipo_persona" :key="t" class="foco-tag">{{ t }}</span>
                  </div>
                </div>
                <div v-if="item.perfil_antiguedad_empresa" class="perfil-item">
                  <span class="perfil-label">Antigüedad empresa</span>
                  <span class="perfil-valor">{{ item.perfil_antiguedad_empresa }}</span>
                </div>
                <div v-if="item.perfil_nivel_ventas" class="perfil-item">
                  <span class="perfil-label">Nivel de ventas</span>
                  <span class="perfil-valor">{{ item.perfil_nivel_ventas }}</span>
                </div>
                <div v-if="item.perfil_nivel_desarrollo" class="perfil-item">
                  <span class="perfil-label">Nivel de desarrollo</span>
                  <div class="perfil-tags" v-if="parsedNivelDesarrollo(item.perfil_nivel_desarrollo).length > 1">
                    <span v-for="n in parsedNivelDesarrollo(item.perfil_nivel_desarrollo)" :key="n" class="foco-tag">{{ n }}</span>
                  </div>
                  <span v-else class="perfil-valor">{{ parsedNivelDesarrollo(item.perfil_nivel_desarrollo)[0] ?? item.perfil_nivel_desarrollo }}</span>
                </div>
                <div v-if="item.perfil_limite_edad !== null && item.perfil_limite_edad !== undefined" class="perfil-item">
                  <span class="perfil-label">Límite de edad</span>
                  <span class="perfil-valor">{{ item.perfil_limite_edad ? 'Sí aplica' : 'No aplica' }}</span>
                </div>
              </div>
            </section>

            <!-- Criterios de evaluación -->
            <section class="card-section" v-if="item.criterios_evaluacion">
              <h2>Criterios de evaluación</h2>
              <p class="descripcion">{{ item.criterios_evaluacion }}</p>
            </section>

            <!-- Focos -->
            <section class="card-section" v-if="item.foco?.length">
              <h2>Áreas de foco</h2>
              <div class="focos-wrap">
                <span v-for="f in item.foco" :key="f" class="foco-tag">{{ f }}</span>
              </div>
            </section>

            <!-- Texto raw como respaldo -->
            <div class="sin-descripcion" v-if="!item.descripcion_breve">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span>Descripción no disponible aún. Puedes revisar la información directamente en la fuente oficial.</span>
              <a v-if="item.url_original" :href="item.url_original" target="_blank" rel="noopener" class="link-fuente">Ver en fuente original →</a>
            </div>

          </div>

          <!-- Columna lateral -->
          <div class="col-side">

            <!-- Plazos -->
            <div class="side-card" v-if="item.fecha_cierre_postulacion || item.fecha_inicio_postulacion">
              <h3>Plazos</h3>
              <div class="side-rows">
                <div v-if="item.fecha_inicio_postulacion" class="side-row">
                  <span class="side-label">Apertura</span>
                  <span class="side-val">{{ formatFecha(item.fecha_inicio_postulacion) }}</span>
                </div>
                <div v-if="item.fecha_cierre_postulacion" class="side-row">
                  <span class="side-label">Cierre</span>
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

            <!-- Financiamiento -->
            <div class="side-card" v-if="item.monto_rango || item.monto_maximo || item.es_reembolsable !== null || item.porcentaje_cofinanciamiento !== null || item.plazo_ejecucion">
              <h3>Financiamiento</h3>
              <div class="side-rows">
                <div v-if="item.monto_maximo" class="side-row">
                  <span class="side-label">Monto máximo por beneficiario</span>
                  <span class="side-val monto-exacto">{{ formatMonto(item.monto_maximo) }}</span>
                </div>
                <div v-else-if="item.monto_rango" class="side-row">
                  <span class="side-label">Monto estimado</span>
                  <span class="side-val">{{ montoLabel(item.monto_rango) }}</span>
                </div>
                <div v-if="item.es_reembolsable !== null && item.es_reembolsable !== undefined" class="side-row">
                  <span class="side-label">¿Se devuelve?</span>
                  <span :class="['side-val', 'badge-reembolso', item.es_reembolsable ? 'reembolsable' : 'no-reembolsable']">
                    {{ item.es_reembolsable ? 'Sí — crédito' : 'No — subsidio' }}
                  </span>
                </div>
                <div v-if="item.porcentaje_cofinanciamiento !== null && item.porcentaje_cofinanciamiento !== undefined" class="side-row">
                  <span class="side-label">Aporte propio requerido</span>
                  <span class="side-val">{{ item.porcentaje_cofinanciamiento === 0 ? 'Sin cofinanciamiento' : `${item.porcentaje_cofinanciamiento}%` }}</span>
                </div>
                <div v-if="item.plazo_ejecucion" class="side-row">
                  <span class="side-label">Plazo de ejecución</span>
                  <span class="side-val">{{ item.plazo_ejecucion }}</span>
                </div>
              </div>
            </div>

            <!-- Alcance -->
            <div class="side-card" v-if="item.alcance || item.region">
              <h3>Alcance</h3>
              <div class="side-rows">
                <div v-if="item.alcance" class="side-row">
                  <span class="side-label">Cobertura</span>
                  <span class="side-val">{{ alcanceLabel(item.alcance) }}</span>
                </div>
                <div v-if="item.region" class="side-row">
                  <span class="side-label">Región</span>
                  <span class="side-val">{{ item.region }}</span>
                </div>
              </div>
            </div>

            <!-- Compatibilidad -->
            <div v-if="matchResult" class="side-card match-card-side">
              <h3>Tu compatibilidad</h3>
              <div class="match-score-wrap">
                <div :class="['match-donut', matchResult.nivel]">
                  <span class="match-pct">{{ matchResult.score }}%</span>
                </div>
                <div class="match-nivel-wrap">
                  <span :class="['match-nivel-label', matchResult.nivel]">
                    {{ { alto: 'Alto match', medio: 'Match parcial', bajo: 'Bajo match' }[matchResult.nivel] }}
                  </span>
                  <NuxtLink to="/dashboard/match" class="match-ver-todos">Ver Mis Match →</NuxtLink>
                </div>
              </div>
              <div class="match-razones">
                <div v-for="(r, i) in matchResult.razones.slice(0, 4)" :key="i" :class="['match-razon', r.tipo]">
                  <span class="razon-icono">{{ r.tipo === 'positivo' ? '✓' : r.tipo === 'negativo' ? '✗' : '·' }}</span>
                  <span class="razon-texto">{{ r.texto }}</span>
                </div>
              </div>
            </div>

            <!-- Organizador -->
            <div v-if="item.organizador && otrosDelOrganizador > 0" class="side-card">
              <h3>Organizador</h3>
              <p class="org-nombre">{{ item.organizador }}</p>
              <NuxtLink
                :to="`/dashboard?q=${encodeURIComponent(item.organizador)}`"
                class="org-link"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                Ver {{ otrosDelOrganizador }} fondo{{ otrosDelOrganizador !== 1 ? 's' : '' }} abierto{{ otrosDelOrganizador !== 1 ? 's' : '' }} de este organizador
              </NuxtLink>
            </div>

            <!-- Contacto / dudas -->
            <div class="side-card" v-if="item.contacto">
              <h3>Consultas</h3>
              <div class="side-rows">
                <div class="side-row contacto-row">
                  <span class="side-label">Contacto</span>
                  <a v-if="contactoEsEmail" :href="`mailto:${item.contacto}`" class="side-val contacto-link">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    {{ item.contacto }}
                  </a>
                  <span v-else class="side-val">{{ item.contacto }}</span>
                </div>
              </div>
            </div>

            <!-- Fuente -->
            <div class="side-card">
              <h3>Fuente</h3>
              <div class="side-rows">
                <div class="side-row">
                  <span class="side-label">Origen</span>
                  <span class="side-val">{{ fuenteLabel(item.fuente) }}</span>
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
import { calcularMatch, cargarPerfil, type MatchResult } from '~/shared/match'

definePageMeta({ middleware: 'auth', layout: false })

const supabase = useSupabaseClient()
const route = useRoute()

const item              = ref<any>(null)

// El scraper concatena trozos de la página con " | ". Los partimos en líneas
// para que la descripción se lea como párrafos en vez de un bloque con pipes.
const descripcionLineas = computed<string[]>(() =>
  (item.value?.descripcion_breve || '')
    .split('|')
    .map((s: string) => s.trim())
    .filter(Boolean)
)
const loading           = ref(true)
const guardado          = ref(false)
const postulado         = ref(false)
const totalGuardados    = ref(0)
const matchResult       = ref<MatchResult | null>(null)
const otrosDelOrganizador = ref(0)
const edicionesAnteriores = ref(0)
const { plan, canUseMatch, load: loadPlan } = usePlan()

const tienePerfilRequerido = computed(() =>
  item.value?.perfil_tipo_persona?.length ||
  item.value?.perfil_antiguedad_empresa ||
  item.value?.perfil_nivel_ventas ||
  item.value?.perfil_nivel_desarrollo ||
  item.value?.perfil_limite_edad !== null
)

const contactoEsEmail = computed(() => {
  const c = item.value?.contacto
  return typeof c === 'string' && /^[\w.+-]+@[\w-]+(?:\.[\w-]+)+$/.test(c.trim())
})

onMounted(async () => {
  const id = route.params.id as string

  const [{ data }, { data: g }, { data: p }, { count: cGuardados }] = await Promise.all([
    supabase.from('convocatorias').select('*').eq('id', id).single(),
    supabase.from('guardados').select('id').eq('convocatoria_id', id).maybeSingle(),
    supabase.from('postulaciones').select('id').eq('convocatoria_id', id).maybeSingle(),
    supabase.from('guardados').select('id', { count: 'exact', head: true }).eq('convocatoria_id', id),
  ])
  item.value           = data
  guardado.value       = !!g
  postulado.value      = !!p
  totalGuardados.value = cGuardados ?? 0
  loading.value        = false

  // Datos del organizador: otros fondos abiertos + ediciones anteriores
  if (data?.organizador) {
    const [{ count: cOtros }, { count: cAnt }] = await Promise.all([
      supabase.from('convocatorias')
        .select('id', { count: 'exact', head: true })
        .eq('organizador', data.organizador)
        .eq('estado', 'abierto')
        .neq('id', id),
      supabase.from('convocatorias')
        .select('id', { count: 'exact', head: true })
        .eq('organizador', data.organizador)
        .eq('estado', 'cerrado'),
    ])
    otrosDelOrganizador.value  = cOtros ?? 0
    edicionesAnteriores.value  = cAnt ?? 0
  }

  // Calcular compatibilidad para todos los planes con match habilitado (Starter+)
  await loadPlan()
  if (canUseMatch.value) {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const perfil = await cargarPerfil(supabase, user.id)
      if (perfil.tipo_persona || perfil.foco.length > 0) {
        matchResult.value = calcularMatch(perfil, data)
      }
    }
  }
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

async function togglePostulado() {
  const id = route.params.id as string
  if (postulado.value) {
    await supabase.from('postulaciones').delete().eq('convocatoria_id', id)
    postulado.value = false
  } else {
    await supabase.from('postulaciones').insert({ convocatoria_id: id })
    postulado.value = true
  }
}

function parsedNivelDesarrollo(val: string): string[] {
  if (!val) return []
  try {
    const parsed = JSON.parse(val)
    if (Array.isArray(parsed)) return parsed.map(String)
  } catch {}
  return [val]
}

// Documentos vienen como "nombre|url" (formato del scraper). Datos antiguos o de
// otras fuentes pueden venir solo con el nombre → se muestran como texto plano.
function parseDoc(d: string): { label: string, href: string | null } {
  const i = d.indexOf('|')
  if (i === -1) return { label: d, href: null }
  const href = d.slice(i + 1).trim()
  return { label: d.slice(0, i).trim(), href: /^https?:\/\//i.test(href) ? href : null }
}

function fuenteLabel(f: string) {
  const map: Record<string, string> = {
    corfo: 'CORFO', sercotec: 'SERCOTEC', anid: 'ANID',
    mercadopublico: 'Mercado Público', fondos_gob: 'Fondos.gob.cl',
    incubadoras: 'Incubadoras', fondos_cultura: 'Fondos Cultura',
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

function formatMonto(n: number) {
  if (!n) return '—'
  return '$' + n.toLocaleString('es-CL')
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

/* Hero */
.hero {
  margin-bottom: 1.25rem;
}
.source-logo-hero {
  width: 48px; height: 48px;
  border-radius: 10px;
  object-fit: cover;
  flex-shrink: 0;
}
.hero-tags {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}
.hero-top {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}
h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.025em;
  line-height: 1.3;
}
.organizador-wrap { display: flex; flex-direction: column; gap: 0.5rem; }
.organizador {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.875rem;
  color: #64748b;
  font-weight: 500;
}
.chip-recurrente {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: #6366f1;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  width: fit-content;
}
.org-nombre { font-size: 0.875rem; font-weight: 600; color: #334155; margin-bottom: 0.625rem; }
.org-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: #0ea5e9;
  text-decoration: none;
  transition: color 0.15s;
}
.org-link:hover { color: #0284c7; }

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

/* Acciones */
.acciones {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 2rem;
}
.btn-postular {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.625rem 1.25rem;
  background: #0ea5e9;
  color: white;
  font-size: 0.9rem;
  font-weight: 600;
  border-radius: 10px;
  text-decoration: none;
  transition: background 0.15s;
  font-family: 'Inter', sans-serif;
}
.btn-postular:hover { background: #0284c7; }

.btn-guardar-detalle { cursor: pointer; font-family: 'Inter', sans-serif; }
.btn-guardar-detalle.guardado { border-color: #0ea5e9; color: #0ea5e9; background: #f0f9ff; }
.guardados-count {
  background: #0ea5e9;
  color: white;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0.1rem 0.35rem;
  border-radius: 999px;
  margin-left: 0.1rem;
}
.btn-postule { cursor: pointer; font-family: 'Inter', sans-serif; }
.btn-postule.postulado { border-color: #22c55e; color: #16a34a; background: #f0fdf4; }

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
}
.btn-secundario:hover { border-color: #0ea5e9; color: #0ea5e9; }

/* Grid layout */
.grid {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 1.5rem;
  align-items: start;
}

/* Card sections */
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
.descripcion {
  font-size: 0.9375rem;
  color: #334155;
  line-height: 1.7;
}
.descripcion p { margin-bottom: 0.6rem; }
.descripcion p:last-child { margin-bottom: 0; }

/* Perfil */
.perfil-grid { display: flex; flex-direction: column; gap: 0.875rem; }
.perfil-item { display: flex; flex-direction: column; gap: 0.3rem; }
.perfil-label { font-size: 0.75rem; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; }
.perfil-valor { font-size: 0.9rem; color: #334155; font-weight: 500; }
.perfil-tags { display: flex; flex-wrap: wrap; gap: 0.35rem; }

/* Focos */
.focos-wrap { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.foco-tag {
  font-size: 0.8rem; font-weight: 500;
  padding: 0.25rem 0.6rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  color: #64748b;
}

.sin-descripcion {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  flex-wrap: wrap;
  padding: 1rem 1.25rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 0.875rem;
  color: #64748b;
  line-height: 1.5;
}
.link-fuente {
  color: #0ea5e9;
  text-decoration: none;
  font-weight: 500;
  white-space: nowrap;
}
.link-fuente:hover { text-decoration: underline; }

/* Side cards */
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
.contacto-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: #2563eb;
  text-decoration: none;
  word-break: break-all;
}
.contacto-link:hover { text-decoration: underline; }
.contacto-link svg { flex-shrink: 0; }
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

/* Requisitos */
.requisitos-lista { list-style: none; display: flex; flex-direction: column; gap: 0.625rem; }
.requisito-item {
  display: flex; align-items: flex-start; gap: 0.5rem;
  font-size: 0.9rem; color: #334155; line-height: 1.5;
}
.requisito-item svg { color: #16a34a; flex-shrink: 0; margin-top: 0.2rem; }
.doc-link { color: #0284c7; text-decoration: none; }
.doc-link:hover { text-decoration: underline; }

/* Financiamiento */
.monto-exacto { font-size: 1.05rem; font-weight: 800; color: #0f172a; }
.badge-reembolso {
  font-size: 0.75rem; font-weight: 700;
  padding: 0.2rem 0.6rem; border-radius: 999px;
}
.badge-reembolso.no-reembolsable { background: #f0fdf4; color: #16a34a; }
.badge-reembolso.reembolsable    { background: #fefce8; color: #a16207; }

/* Match side card */
.match-card-side { border-color: #e0f2fe; }
.match-score-wrap { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; }
.match-donut {
  width: 56px; height: 56px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.9rem; font-weight: 800; color: white;
}
.match-donut.alto   { background: linear-gradient(135deg, #22c55e, #16a34a); }
.match-donut.medio  { background: linear-gradient(135deg, #f59e0b, #d97706); }
.match-donut.bajo   { background: linear-gradient(135deg, #94a3b8, #64748b); }
.match-nivel-wrap { display: flex; flex-direction: column; gap: 0.25rem; }
.match-nivel-label { font-size: 0.8rem; font-weight: 700; }
.match-nivel-label.alto  { color: #16a34a; }
.match-nivel-label.medio { color: #d97706; }
.match-nivel-label.bajo  { color: #64748b; }
.match-ver-todos { font-size: 0.75rem; color: #0ea5e9; text-decoration: none; font-weight: 500; }
.match-ver-todos:hover { text-decoration: underline; }
.match-razones { display: flex; flex-direction: column; gap: 0.4rem; }
.match-razon { display: flex; gap: 0.5rem; align-items: flex-start; font-size: 0.8rem; line-height: 1.4; }
.razon-icono { font-size: 0.75rem; font-weight: 800; flex-shrink: 0; margin-top: 0.05rem; }
.razon-texto { color: #475569; }
.match-razon.positivo .razon-icono { color: #16a34a; }
.match-razon.negativo .razon-icono { color: #ef4444; }
.match-razon.neutro   .razon-icono { color: #94a3b8; }
.match-razon.negativo .razon-texto { color: #94a3b8; }

/* Loading / empty */
.loading-wrap {
  display: flex;
  justify-content: center;
  padding: 4rem;
}
.empty-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 4rem;
  color: #64748b;
  font-size: 0.9rem;
}
.btn-primary {
  padding: 0.625rem 1.25rem;
  background: #0ea5e9;
  color: white;
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: 10px;
  text-decoration: none;
}

.spinner {
  width: 28px; height: 28px;
  border: 3px solid #e2e8f0;
  border-top-color: #0ea5e9;
  border-radius: 50%;
  animation: spin 0.65s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 768px) {
  .content { padding: 1.5rem 1rem; }
  .grid { grid-template-columns: 1fr; }
  h1 { font-size: 1.25rem; }
}
</style>
