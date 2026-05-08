<template>
  <div class="page">

    <!-- Header -->
    <div class="top-bar">
      <div class="brand">
        <img src="~/assets/images/logo-light.png" alt="Fondos y Licitaciones" class="brand-logo" />
      </div>
      <button v-if="paso < 5" class="skip-btn" @click="saltar">
        Saltar por ahora
      </button>
    </div>

    <!-- Progreso -->
    <div class="progress-wrap" v-if="paso < 5">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: `${(paso / 4) * 100}%` }"></div>
      </div>
      <span class="progress-label">Paso {{ paso }} de 4</span>
    </div>

    <div class="content">

      <!-- ── PASO 1: Bienvenida ─────────────────────────────────── -->
      <transition name="fade" mode="out-in">
      <div v-if="paso === 1" key="1" class="step">
        <div class="step-icon step-icon-blue">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6.002 6.002 0 0 0-4-5.659V5a2 2 0 1 0-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"/></svg>
        </div>
        <h1>Bienvenido a Fondos y Licitaciones</h1>
        <p class="step-desc">
          En <strong>3 minutos</strong> configuramos tu perfil para que veas solo las oportunidades que realmente te sirven — y no te pierdas ninguna.
        </p>

        <div class="benefit-list">
          <div class="benefit-item">
            <div class="benefit-icon">🎯</div>
            <div>
              <strong>Alertas personalizadas</strong>
              <p>Configuramos tus criterios para que filtres automáticamente.</p>
            </div>
          </div>
          <div class="benefit-item">
            <div class="benefit-icon">📧</div>
            <div>
              <strong>Email diario con novedades</strong>
              <p>Cada mañana recibes en <strong>{{ email }}</strong> las oportunidades nuevas.</p>
            </div>
          </div>
          <div class="benefit-item">
            <div class="benefit-icon">⭐</div>
            <div>
              <strong>Match inteligente (Plan Pro)</strong>
              <p>Te decimos con % exacto si calificas para cada fondo.</p>
            </div>
          </div>
        </div>

        <button class="btn-primary btn-lg" @click="siguiente">
          Empezar configuración
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </button>
      </div>

      <!-- ── PASO 2: ¿Quién postula? ────────────────────────────── -->
      <div v-else-if="paso === 2" key="2" class="step">
        <h1>¿Quién va a postular?</h1>
        <p class="step-desc">Esto nos ayuda a filtrar los fondos según los requisitos de elegibilidad.</p>

        <div class="field-group">
          <label class="field-label">Tipo de postulante</label>
          <div class="radio-cards">
            <label class="radio-card" :class="{ selected: perfil.tipo_persona === 'natural' }">
              <input type="radio" value="natural" v-model="perfil.tipo_persona" />
              <div class="radio-card-icon">👤</div>
              <div class="radio-card-text">
                <strong>Persona Natural</strong>
                <span>Emprendedor individual</span>
              </div>
            </label>
            <label class="radio-card" :class="{ selected: perfil.tipo_persona === 'juridica' }">
              <input type="radio" value="juridica" v-model="perfil.tipo_persona" />
              <div class="radio-card-icon">🏢</div>
              <div class="radio-card-text">
                <strong>Persona Jurídica</strong>
                <span>Empresa o sociedad</span>
              </div>
            </label>
          </div>
        </div>

        <template v-if="perfil.tipo_persona === 'natural'">
          <div class="field-group">
            <label class="field-label">¿Eres profesional?</label>
            <div class="radios">
              <label class="radio-item">
                <input type="radio" value="no_profesional" v-model="perfil.subtipo_natural" />
                <span class="radio-circle"></span>No profesional
              </label>
              <label class="radio-item">
                <input type="radio" value="profesional" v-model="perfil.subtipo_natural" />
                <span class="radio-circle"></span>Profesional
              </label>
            </div>
          </div>
          <div class="field-group">
            <label class="field-label">Edad <span class="field-opt">(opcional)</span></label>
            <input v-model.number="perfil.edad" type="number" min="18" max="99" class="text-input input-sm" placeholder="ej: 32" />
          </div>
        </template>

        <template v-if="perfil.tipo_persona === 'juridica'">
          <div class="field-group">
            <label class="field-label">Antigüedad de la empresa</label>
            <div class="select-wrap">
              <select v-model="perfil.antiguedad_empresa" class="select-input">
                <option value="">Seleccionar</option>
                <option value="menos_1">Menos de 1 año</option>
                <option value="1_3">1 a 3 años</option>
                <option value="3_5">3 a 5 años</option>
                <option value="mas_5">Más de 5 años</option>
              </select>
            </div>
          </div>
        </template>

        <div class="step-actions">
          <button class="btn-ghost" @click="anterior">Atrás</button>
          <button class="btn-primary" @click="siguiente" :disabled="!perfil.tipo_persona">Continuar</button>
        </div>
      </div>

      <!-- ── PASO 3: Tu proyecto ────────────────────────────────── -->
      <div v-else-if="paso === 3" key="3" class="step">
        <h1>Cuéntanos sobre tu proyecto</h1>
        <p class="step-desc">Usamos esta información para encontrar los fondos que calzan con tu etapa y sector.</p>

        <div class="field-group">
          <label class="field-label">¿En qué etapa está tu proyecto?</label>
          <div class="etapa-list">
            <label v-for="e in estados" :key="e.value" class="etapa-item" :class="{ selected: perfil.estado_proyecto === e.value }">
              <input type="radio" :value="e.value" v-model="perfil.estado_proyecto" />
              <span class="etapa-emoji">{{ e.emoji }}</span>
              <span class="etapa-label">{{ e.label }}</span>
            </label>
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">Foco del proyecto <span class="field-opt">(selección múltiple)</span></label>
          <div class="checks-grid">
            <label v-for="f in focos" :key="f" class="check-item" :class="{ selected: perfil.foco_proyecto.includes(f) }">
              <input type="checkbox" :value="f" v-model="perfil.foco_proyecto" />
              <span class="check-box"></span>
              {{ f }}
            </label>
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">Palabras clave <span class="field-opt">(opcional — Enter para agregar)</span></label>
          <div class="tags-input">
            <span v-for="(tag, i) in perfil.palabras_clave" :key="i" class="tag">
              {{ tag }}<button type="button" @click="removeTag(i)">×</button>
            </span>
            <input v-model="tagInput" type="text" placeholder="ej: exportación, tecnología, reciclaje…"
              @keydown.enter.prevent="addTag" @keydown.comma.prevent="addTag" />
          </div>
        </div>

        <div class="step-actions">
          <button class="btn-ghost" @click="anterior">Atrás</button>
          <button class="btn-primary" @click="siguiente">Continuar</button>
        </div>
      </div>

      <!-- ── PASO 4: Primera alerta ─────────────────────────────── -->
      <div v-else-if="paso === 4" key="4" class="step">
        <h1>Configura tu primera alerta</h1>
        <p class="step-desc">Te avisaremos por email cuando aparezcan oportunidades nuevas. Puedes crear más después.</p>

        <div class="field-group">
          <label class="field-label">Nombre de la alerta</label>
          <input v-model="alerta.nombre" type="text" class="text-input" placeholder='ej: "Fondos generales", "CORFO Tech"…' />
        </div>

        <div class="field-group">
          <label class="field-label">¿Qué tipo de oportunidades quieres? <span class="field-opt">(opcional)</span></label>
          <div class="checks-row">
            <label class="check-item">
              <input type="checkbox" value="fondo" v-model="alerta.tipos" /><span class="check-box"></span>Fondos concursables
            </label>
            <label class="check-item">
              <input type="checkbox" value="licitacion" v-model="alerta.tipos" /><span class="check-box"></span>Licitaciones
            </label>
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">Fuentes de interés <span class="field-opt">(opcional — vacío = todas)</span></label>
          <div class="checks-row checks-wrap">
            <label v-for="f in fuentes" :key="f.value" class="check-item">
              <input type="checkbox" :value="f.value" v-model="alerta.fuentes" /><span class="check-box"></span>{{ f.label }}
            </label>
          </div>
        </div>

        <div class="step-actions">
          <button class="btn-ghost" @click="anterior">Atrás</button>
          <button class="btn-primary" @click="finalizar" :disabled="guardando || !alerta.nombre.trim()">
            <span v-if="guardando" class="spinner"></span>
            {{ guardando ? 'Guardando...' : 'Finalizar configuración' }}
          </button>
        </div>
      </div>

      <!-- ── PASO 5: ¡Listo! + matches ──────────────────────────── -->
      <div v-else-if="paso === 5" key="5" class="step step-final">
        <!-- Redirigiendo a pago -->
        <template v-if="redirigiendo">
          <div class="confetti-wrap">🎉</div>
          <h1>¡Configuración lista!</h1>
          <div class="match-loading">
            <div class="spinner-match"></div>
            <span>Redirigiendo a pago…</span>
          </div>
        </template>

        <!-- Normal: sin plan intención -->
        <template v-else-if="!planIntencion">
          <div class="confetti-wrap">🎉</div>
          <h1>¡Todo listo!</h1>

          <!-- Loading matches -->
          <div v-if="calculandoMatch" class="match-loading">
            <div class="spinner-match"></div>
            <span>Calculando fondos que calzan con tu perfil…</span>
          </div>

          <!-- Resultados de match -->
          <template v-else-if="matchResults.length">
            <p class="step-desc">
              Encontramos <strong>{{ matchResults.length }} fondos abiertos</strong> que calzan con tu proyecto. Aquí una vista previa:
            </p>

            <div class="match-preview-list">
              <div v-for="r in matchResults" :key="r.item.id" class="match-preview-card">
                <div class="match-preview-top">
                  <div :class="['match-donut-sm', r.match.nivel]">{{ r.match.score }}%</div>
                  <div class="match-preview-info">
                    <p class="match-preview-titulo">{{ r.item.titulo }}</p>
                    <p class="match-preview-org">{{ r.item.organizador }}</p>
                  </div>
                </div>
                <div class="match-razones-sm">
                  <span v-for="rz in r.match.razones.slice(0, 2)" :key="rz.texto" :class="['razon-chip', rz.tipo]">
                    {{ rz.tipo === 'positivo' ? '✓' : rz.tipo === 'negativo' ? '✗' : '·' }} {{ rz.texto }}
                  </span>
                </div>
              </div>
            </div>

            <div class="match-cta-wrap">
              <NuxtLink to="/planes" class="btn-primary btn-lg">
                Ver mi match completo
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </NuxtLink>
              <NuxtLink to="/dashboard" class="btn-ghost">Ir a mi dashboard</NuxtLink>
            </div>
          </template>

          <!-- Fallback sin matches -->
          <template v-else>
            <p class="step-desc">Tu perfil y primera alerta están configurados. Desde mañana recibirás un email con las oportunidades nuevas.</p>
            <NuxtLink to="/dashboard" class="btn-primary btn-lg">
              Ir a mi dashboard
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </NuxtLink>
          </template>
        </template>
      </div>
      </transition>

    </div>
  </div>
</template>

<script setup lang="ts">
import { calcularMatch, type Perfil } from '~/composables/useMatch'

definePageMeta({ middleware: 'auth' })

const supabase = useSupabaseClient()
const { contratar: contratarPlan } = useContratarPlan()
const paso     = ref(1)
const guardando       = ref(false)
const calculandoMatch = ref(false)
const redirigiendo    = ref(false)
const matchResults    = ref<{ item: any; match: ReturnType<typeof calcularMatch> }[]>([])
const tagInput  = ref('')
const email     = ref('')

// Si el usuario llegó desde la web (fyl) eligiendo un plan pago, registro.vue lo dejó
// guardado en localStorage. Lo leemos para ofrecer "Contratar Plan X" al final del onboarding.
const planIntencion      = ref<string | null>(null)
const PLAN_NOMBRES: Record<string, string> = { starter: 'Starter', advanced: 'Advanced', agency: 'Agency' }
const planIntencionLabel = computed(() => planIntencion.value ? PLAN_NOMBRES[planIntencion.value] ?? '' : '')

const perfil = ref({
  tipo_persona:       null as string | null,
  subtipo_natural:    null as string | null,
  edad:               null as number | null,
  antiguedad_empresa: null as string | null,
  estado_proyecto:    null as string | null,
  foco_proyecto:      [] as string[],
  palabras_clave:     [] as string[],
})

const alerta = ref({
  nombre:  'Mi primera alerta',
  tipos:   [] as string[],
  fuentes: [] as string[],
})

const estados = [
  { value: 'solo_idea',     label: 'Solo idea',                emoji: '💡' },
  { value: 'maqueta',       label: 'Maqueta',                  emoji: '📐' },
  { value: 'prototipo',     label: 'Prototipo funcional',      emoji: '🔧' },
  { value: 'marcha_blanca', label: 'Marcha blanca con ventas', emoji: '🚀' },
  { value: 'crecimiento',   label: 'Buscando crecer',          emoji: '📈' },
]

const focos = [
  'Agroindustrias', 'Banca y Fintech', 'Climatech', 'Descarbonización',
  'Digitalización', 'Educación', 'Economía Verde', 'I+D+i',
  'Industrial', 'Innovación Social', 'Mujeres', 'Multisectorial',
  'Recursos Forestales', 'Recursos Hídricos', 'Tech',
]

const fuentes = [
  { value: 'corfo',          label: 'CORFO' },
  { value: 'sercotec',       label: 'SERCOTEC' },
  { value: 'anid',           label: 'ANID' },
  { value: 'mercadopublico', label: 'Mercado Público' },
  { value: 'fondos_gob',     label: 'Fondos.gob.cl' },
]

function siguiente() { paso.value++ }
function anterior()  { paso.value-- }

function addTag() {
  const val = tagInput.value.trim().replace(',', '')
  if (val && !perfil.value.palabras_clave.includes(val))
    perfil.value.palabras_clave.push(val)
  tagInput.value = ''
}
function removeTag(i: number) {
  perfil.value.palabras_clave.splice(i, 1)
}

async function saltar() {
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('profiles').update({ onboarding_done: true }).eq('id', user!.id)
  navigateTo('/dashboard')
}

async function finalizar() {
  if (!alerta.value.nombre.trim()) return
  guardando.value = true

  const { data: { user } } = await supabase.auth.getUser()

  const proyectoPayload = {
    user_id:            user!.id,
    nombre:             'Mi Proyecto',
    tipo_persona:       perfil.value.tipo_persona,
    subtipo_natural:    perfil.value.tipo_persona === 'natural'  ? perfil.value.subtipo_natural    : null,
    edad:               perfil.value.tipo_persona === 'natural'  ? perfil.value.edad               : null,
    antiguedad_empresa: perfil.value.tipo_persona === 'juridica' ? perfil.value.antiguedad_empresa : null,
    estado_proyecto:    perfil.value.estado_proyecto,
    foco:               perfil.value.foco_proyecto,
    palabras_clave:     perfil.value.palabras_clave,
    updated_at:         new Date().toISOString(),
  }

  const { data: existente } = await supabase
    .from('proyectos')
    .select('id')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  await Promise.all([
    existente
      ? supabase.from('proyectos').update(proyectoPayload).eq('id', existente.id)
      : supabase.from('proyectos').insert(proyectoPayload),

    supabase.from('alert_configs').insert({
      user_id:  user!.id,
      nombre:   alerta.value.nombre.trim(),
      tipos:    alerta.value.tipos,
      fuentes:  alerta.value.fuentes,
      activo:   true,
    }),

    supabase.from('profiles').update({ onboarding_done: true }).eq('id', user!.id),
  ])

  // Si hay plan intención, redirige a pagar automáticamente
  if (planIntencion.value && planIntencion.value in PLAN_NOMBRES) {
    redirigiendo.value = true
    paso.value = 5
    await contratarPlan(planIntencion.value as 'starter' | 'advanced' | 'agency')
    return
  }

  guardando.value = false
  paso.value = 5

  // Calcular matches con el perfil recién guardado
  calculandoMatch.value = true
  try {
    const { data: fondos } = await supabase
      .from('convocatorias')
      .select('id, titulo, organizador, foco, perfil_tipo_persona, perfil_nivel_desarrollo, monto_rango, alcance')
      .eq('estado', 'abierto')
      .eq('tipo', 'fondo')
      .limit(60)

    const perfilMatch: Perfil = {
      tipo_persona:    perfil.value.tipo_persona,
      estado_proyecto: perfil.value.estado_proyecto,
      foco:            perfil.value.foco_proyecto,
      alcance:         [],
      monto_minimo:    null,
    }

    matchResults.value = (fondos ?? [])
      .map(f => ({ item: f, match: calcularMatch(perfilMatch, f) }))
      .filter(r => r.match.score >= 40)
      .sort((a, b) => b.match.score - a.match.score)
      .slice(0, 5)
  } catch {
    // silencioso — fallback sin matches
  } finally {
    calculandoMatch.value = false
  }
}

onMounted(async () => {
  const { data: { user } } = await supabase.auth.getUser()
  email.value = user?.email ?? ''

  try {
    const stored = localStorage.getItem('plan_intencion')
    if (stored && stored in PLAN_NOMBRES) planIntencion.value = stored
  } catch {}
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.page {
  min-height: 100vh; background: #f8fafc;
  font-family: 'Inter', sans-serif; display: flex; flex-direction: column;
}

/* Top bar */
.top-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1.25rem 2rem; background: white; border-bottom: 1px solid #e2e8f0;
}
.brand {
  display: flex;
  align-items: center;
}
.brand-logo {
  height: 50px;
  width: auto;
}
.skip-btn {
  background: none; border: none; font-size: 0.8125rem; color: #94a3b8;
  cursor: pointer; font-family: inherit; transition: color 0.15s; padding: 0.25rem 0;
}
.skip-btn:hover { color: #64748b; }

/* Progress */
.progress-wrap {
  padding: 0.875rem 2rem; display: flex; align-items: center; gap: 1rem;
  background: white; border-bottom: 1px solid #f1f5f9;
}
.progress-bar {
  flex: 1; height: 4px; background: #e2e8f0; border-radius: 999px; overflow: hidden;
}
.progress-fill {
  height: 100%; background: #0ea5e9; border-radius: 999px;
  transition: width 0.4s ease;
}
.progress-label { font-size: 0.75rem; font-weight: 600; color: #94a3b8; white-space: nowrap; }

/* Content */
.content {
  flex: 1; display: flex; align-items: flex-start; justify-content: center;
  padding: 3rem 1.5rem;
}

/* Steps */
.step {
  width: 100%; max-width: 560px; display: flex; flex-direction: column; gap: 1.75rem;
}
.step-icon {
  width: 60px; height: 60px; border-radius: 16px;
  display: flex; align-items: center; justify-content: center; color: white;
}
.step-icon-blue { background: linear-gradient(135deg, #0ea5e9, #6366f1); }

h1 { font-size: 1.625rem; font-weight: 800; color: #0f172a; letter-spacing: -0.025em; line-height: 1.2; }
.step-desc { font-size: 0.9375rem; color: #64748b; line-height: 1.65; margin-top: -0.75rem; }

/* Bienvenida */
.benefit-list { display: flex; flex-direction: column; gap: 1rem; }
.benefit-item {
  display: flex; align-items: flex-start; gap: 1rem;
  background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1rem 1.25rem;
}
.benefit-icon { font-size: 1.5rem; flex-shrink: 0; }
.benefit-item strong { display: block; font-size: 0.9rem; font-weight: 700; color: #0f172a; margin-bottom: 0.15rem; }
.benefit-item p { font-size: 0.8375rem; color: #64748b; margin: 0; line-height: 1.5; }

/* Radio cards */
.radio-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.radio-card {
  border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 1.25rem;
  cursor: pointer; display: flex; align-items: center; gap: 0.875rem;
  transition: all 0.15s; background: white;
}
.radio-card input { display: none; }
.radio-card.selected { border-color: #0ea5e9; background: #f0f9ff; }
.radio-card-icon { font-size: 1.75rem; }
.radio-card-text strong { display: block; font-size: 0.9rem; font-weight: 700; color: #0f172a; }
.radio-card-text span  { font-size: 0.8rem; color: #94a3b8; }

/* Etapas */
.etapa-list { display: flex; flex-direction: column; gap: 0.5rem; }
.etapa-item {
  display: flex; align-items: center; gap: 0.875rem;
  border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 0.875rem 1rem;
  cursor: pointer; transition: all 0.15s; background: white;
}
.etapa-item input { display: none; }
.etapa-item.selected { border-color: #0ea5e9; background: #f0f9ff; }
.etapa-emoji { font-size: 1.25rem; }
.etapa-label { font-size: 0.9rem; font-weight: 500; color: #374151; }

/* Field groups */
.field-group { display: flex; flex-direction: column; gap: 0.625rem; }
.field-label { font-size: 0.875rem; font-weight: 700; color: #0f172a; }
.field-opt { font-weight: 400; color: #94a3b8; font-size: 0.8rem; }

/* Radios */
.radios { display: flex; gap: 1.5rem; flex-wrap: wrap; }
.radio-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; color: #374151; cursor: pointer; }
.radio-item input { display: none; }
.radio-circle { width: 18px; height: 18px; border: 1.5px solid #cbd5e1; border-radius: 50%; flex-shrink: 0; transition: all 0.15s; background: white; }
.radio-item input:checked + .radio-circle { border-color: #0ea5e9; border-width: 5px; }

/* Checks */
.checks-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; }
.checks-row  { display: flex; gap: 1.25rem; flex-wrap: wrap; }
.checks-wrap { gap: 0.625rem; }
.check-item  { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; color: #374151; cursor: pointer; user-select: none; }
.check-item input { display: none; }
.check-box { width: 17px; height: 17px; border: 1.5px solid #cbd5e1; border-radius: 4px; flex-shrink: 0; transition: all 0.15s; position: relative; background: white; }
.check-item input:checked + .check-box { background: #0ea5e9; border-color: #0ea5e9; }
.check-item input:checked + .check-box::after { content: ''; position: absolute; left: 3px; top: 1px; width: 6px; height: 9px; border: 2px solid white; border-top: none; border-left: none; transform: rotate(45deg); }

/* Inputs */
.text-input {
  width: 100%; padding: 0.7rem 0.875rem; border: 1.5px solid #e2e8f0;
  border-radius: 10px; font-size: 0.9375rem; font-family: inherit; outline: none;
  transition: border-color 0.15s, box-shadow 0.15s; color: #0f172a; background: white;
}
.text-input:focus { border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(14,165,233,0.1); }
.input-sm { max-width: 160px; }

.select-input {
  width: 100%; padding: 0.7rem 0.875rem; border: 1.5px solid #e2e8f0; border-radius: 10px;
  font-size: 0.9rem; font-family: inherit; outline: none; background: white; color: #0f172a;
  cursor: pointer; appearance: none; transition: border-color 0.15s;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 0.875rem center; padding-right: 2.5rem;
}
.select-input:focus { border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(14,165,233,0.1); }

/* Tags */
.tags-input { display: flex; flex-wrap: wrap; gap: 0.4rem; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 0.5rem 0.625rem; background: white; transition: all 0.15s; }
.tags-input:focus-within { border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(14,165,233,0.1); }
.tags-input input { border: none; background: transparent; padding: 0.2rem 0.25rem; flex: 1; min-width: 120px; font-size: 0.9rem; font-family: inherit; outline: none; color: #0f172a; }
.tag { display: flex; align-items: center; gap: 0.25rem; background: #e0f2fe; color: #0284c7; font-size: 0.8rem; font-weight: 600; padding: 0.18rem 0.45rem 0.18rem 0.65rem; border-radius: 999px; }
.tag button { background: none; border: none; color: #7dd3fc; cursor: pointer; font-size: 1rem; padding: 0; line-height: 1; }

/* Botones */
.btn-primary {
  display: inline-flex; align-items: center; gap: 0.5rem; justify-content: center;
  padding: 0.75rem 1.75rem; background: #0ea5e9; color: white;
  font-size: 0.9375rem; font-weight: 700; font-family: inherit;
  border: none; border-radius: 11px; cursor: pointer; transition: background 0.15s; text-decoration: none;
}
.btn-primary:hover:not(:disabled) { background: #0284c7; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary.btn-lg { padding: 0.875rem 2rem; font-size: 1rem; }

.btn-ghost {
  padding: 0.75rem 1.25rem; background: white; border: 1.5px solid #e2e8f0;
  color: #64748b; font-size: 0.9rem; font-weight: 500; font-family: inherit;
  border-radius: 11px; cursor: pointer; transition: all 0.15s;
}
.btn-ghost:hover { border-color: #cbd5e1; color: #475569; }

.step-actions { display: flex; gap: 0.75rem; align-items: center; margin-top: 0.5rem; }

/* Final */
.step-final { align-items: center; text-align: center; }
.confetti-wrap { font-size: 4rem; }

/* Match loading */
.match-loading {
  display: flex; align-items: center; gap: 0.75rem;
  font-size: 0.9rem; color: #64748b; padding: 1rem 0;
}
.spinner-match {
  width: 18px; height: 18px; flex-shrink: 0;
  border: 2px solid #e2e8f0; border-top-color: #0ea5e9;
  border-radius: 50%; animation: spin 0.65s linear infinite;
}

/* Match preview list */
.match-preview-list {
  display: flex; flex-direction: column; gap: 0.625rem; width: 100%; text-align: left;
}
.match-preview-card {
  background: white; border: 1px solid #e2e8f0; border-radius: 12px;
  padding: 1rem 1.125rem; display: flex; flex-direction: column; gap: 0.625rem;
}
.match-preview-top { display: flex; align-items: center; gap: 0.875rem; }
.match-donut-sm {
  width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.75rem; font-weight: 800; color: white;
}
.match-donut-sm.alto  { background: linear-gradient(135deg, #22c55e, #16a34a); }
.match-donut-sm.medio { background: linear-gradient(135deg, #f59e0b, #d97706); }
.match-donut-sm.bajo  { background: linear-gradient(135deg, #94a3b8, #64748b); }
.match-preview-info { flex: 1; min-width: 0; }
.match-preview-titulo {
  font-size: 0.875rem; font-weight: 600; color: #0f172a;
  line-height: 1.35; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.match-preview-org { font-size: 0.775rem; color: #94a3b8; margin-top: 0.1rem; }
.match-razones-sm { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.razon-chip {
  font-size: 0.72rem; font-weight: 500;
  padding: 0.18rem 0.55rem; border-radius: 999px;
  border: 1px solid transparent;
}
.razon-chip.positivo { background: #f0fdf4; color: #15803d; border-color: #bbf7d0; }
.razon-chip.negativo { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
.razon-chip.neutro   { background: #f8fafc; color: #64748b; border-color: #e2e8f0; }

/* CTAs finales */
.match-cta-wrap {
  display: flex; flex-direction: column; align-items: center; gap: 0.75rem; width: 100%;
}

.spinner { width: 15px; height: 15px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.65s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Transitions */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s, transform 0.2s; }
.fade-enter-from { opacity: 0; transform: translateX(16px); }
.fade-leave-to  { opacity: 0; transform: translateX(-16px); }

@media (max-width: 560px) {
  .checks-grid { grid-template-columns: 1fr 1fr; }
  .radio-cards  { grid-template-columns: 1fr; }
  .top-bar { padding: 1rem; }
  .content { padding: 1.5rem 1rem; }
}
</style>
