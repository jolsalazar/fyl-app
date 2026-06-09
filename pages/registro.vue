<template>
  <div class="page">
    <div class="card">

      <!-- Panel izquierdo: landing que comunica valor y reacciona al plan -->
      <aside class="landing-panel">
        <img src="~/assets/images/logo-dark.png" alt="Fondos y Licitaciones" class="lp-logo" />

        <div class="lp-intro">
          <h2 class="lp-headline">No te pierdas ninguna oportunidad de financiamiento</h2>
          <p class="lp-sub">Fondos públicos, privados y licitaciones de todo Chile, en un solo lugar.</p>
        </div>

        <!-- Selector de plan: vive en el panel para que el toggle cambie los beneficios de abajo -->
        <div class="seg" role="tablist" aria-label="Elige tu plan">
          <button
            type="button"
            class="seg-btn"
            :class="{ active: planSeleccionado === 'free' }"
            @click="planSeleccionado = 'free'"
          >
            <span class="seg-name">{{ PLANES_CONFIG.free.icon }} Free</span>
            <span class="seg-price">$0<small>/mes</small></span>
          </button>
          <button
            type="button"
            class="seg-btn"
            :class="{ active: planSeleccionado === 'starter' }"
            @click="planSeleccionado = 'starter'"
          >
            <span class="seg-name">{{ PLANES_CONFIG.starter.icon }} Starter</span>
            <span class="seg-price">${{ PLANES_CONFIG.starter.precio.toLocaleString('es-CL') }}<small>/mes</small></span>
          </button>
        </div>

        <!-- Beneficios dinámicos del plan seleccionado -->
        <ul class="lp-benefits">
          <li v-for="b in beneficios" :key="b">{{ b }}</li>
        </ul>

        <!-- Free: upsell suave a Starter. Starter: reaseguro de que no se cobra ahora. -->
        <button
          v-if="planSeleccionado === 'free'"
          type="button"
          class="lp-upsell"
          @click="planSeleccionado = 'starter'"
        >
          ¿Postulas activamente? Starter suma alertas diarias, Mi Match y comparador →
        </button>
        <p v-else class="lp-reassurance">
          No te cobramos ahora — creas tu cuenta gratis y decides si activas Starter al final.
        </p>

        <!-- Cómo funciona -->
        <div class="lp-steps">
          <div class="lp-step"><span class="lp-step-num">1</span> Cuéntanos qué buscas</div>
          <div class="lp-step"><span class="lp-step-num">2</span> Recibe alertas que calzan contigo</div>
          <div class="lp-step"><span class="lp-step-num">3</span> Postula a tiempo con recordatorios</div>
        </div>

        <!-- Prueba social: copy honesto sin cifras hasta confirmar números reales -->
        <p class="lp-trust">Monitoreamos nuevas oportunidades todos los días para que postules a tiempo.</p>
      </aside>

      <!-- Panel derecho: formulario -->
      <div class="form-panel">
        <h1>Crea tu cuenta</h1>
        <p class="subtitle">Empieza a recibir alertas de oportunidades en minutos</p>

        <!-- Success state -->
        <div v-if="success" class="success-banner">
          <div class="success-icon">✓</div>
          <div>
            <strong>¡Revisa tu email!</strong>
            <p>Te enviamos un link de confirmación a <strong>{{ email }}</strong>. Haz clic en el link para activar tu cuenta.</p>
          </div>
        </div>

        <!-- Email ya registrado: ofrecer login con plan preservado -->
        <div v-else-if="emailExistente" class="info-banner">
          <div class="info-icon">i</div>
          <div>
            <strong>Ya tienes una cuenta</strong>
            <p>El email <strong>{{ email }}</strong> ya está registrado. Inicia sesión para continuar{{ planSeleccionado !== 'free' ? ` con el plan ${PLANES_CONFIG[planSeleccionado].nombre}` : '' }}.</p>
            <NuxtLink :to="loginUrl" class="btn-login-existente">
              Iniciar sesión
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </NuxtLink>
            <button type="button" class="btn-otro-email" @click="emailExistente = false">Usar otro email</button>
          </div>
        </div>

        <form v-else @submit.prevent="handleRegistro">
          <div class="field">
            <label>Email</label>
            <input v-model="email" type="email" required placeholder="tu@empresa.cl" :disabled="loading" />
            <p v-if="emailSugerencia" class="email-hint">
              ¿Quisiste decir
              <button type="button" class="hint-btn" @click="email = emailSugerencia!">{{ emailSugerencia }}</button>?
            </p>
          </div>

          <div class="field">
            <label>Contraseña</label>
            <div class="input-wrap">
              <input v-model="password" :type="verPass ? 'text' : 'password'" required placeholder="Mínimo 8 caracteres" :disabled="loading" />
              <button type="button" class="eye-btn" @click="verPass = !verPass" tabindex="-1">
                <svg v-if="!verPass" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              </button>
            </div>
            <!-- Indicador de seguridad -->
            <div v-if="password.length > 0" class="password-rules">
              <div v-for="r in passwordRules" :key="r.label" :class="['rule', r.ok ? 'ok' : 'pending']">
                <svg v-if="r.ok" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/></svg>
                {{ r.label }}
              </div>
            </div>
          </div>

          <div class="field">
            <label>Confirmar contraseña</label>
            <div class="input-wrap">
              <input v-model="confirmPassword" :type="verConfirm ? 'text' : 'password'" required placeholder="Repite tu contraseña" :disabled="loading" />
              <button type="button" class="eye-btn" @click="verConfirm = !verConfirm" tabindex="-1">
                <svg v-if="!verConfirm" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              </button>
            </div>
          </div>

          <!-- Términos y condiciones -->
          <label class="terms-check">
            <input type="checkbox" v-model="aceptaTerminos" :disabled="loading" />
            <span class="check-box"></span>
            <span>Acepto los <a href="https://fondosylicitaciones.cl/terminos" target="_blank" rel="noopener">términos y condiciones</a> y la <a href="https://fondosylicitaciones.cl/privacidad" target="_blank" rel="noopener">política de privacidad</a></span>
          </label>

          <div v-if="error" class="error-banner">{{ error }}</div>

          <button type="submit" class="btn-submit" :disabled="loading || !passwordValida || !aceptaTerminos">
            <span v-if="loading" class="spinner"></span>
            {{ loading ? 'Creando cuenta...' : (planSeleccionado === 'free' ? 'Crear cuenta gratis' : 'Continuar') }}
          </button>
        </form>

        <p class="footer-link">
          ¿Ya tienes cuenta? <NuxtLink :to="loginUrl">Iniciar sesión</NuxtLink>
        </p>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { PLANES_CONFIG } from '~~/utils/planes'

const supabase = useSupabaseClient()
const router = useRouter()
const route = useRoute()

// Selector Free/Starter del registro. Se siembra con ?plan= si llega (free|starter),
// si no, default a Free para no provocar la sensación de "esto es para cobrarme".
// Solo registra la intención: el cobro de Starter ocurre al final del onboarding.
const planQuery = route.query.plan as string
const planSeleccionado = ref<'free' | 'starter'>(planQuery === 'starter' ? 'starter' : 'free')

// Beneficios mostrados en el panel izquierdo. Derivados de las features de planes.vue,
// resumidos para el contexto de registro. Cambian al togglear el plan.
const BENEFICIOS = {
  free: [
    'Explora todas las oportunidades de fondos y licitaciones',
    'Guarda favoritos y revisa el calendario de cierres',
    '1 alerta activa personalizada',
  ],
  starter: [
    'Todo lo del plan Free',
    'Hasta 3 alertas y 3 proyectos',
    'Email diario con novedades + recordatorios de cierre (7, 3 y 1 día)',
    'Mis Match: score de compatibilidad fondo a fondo con razones',
    'Comparador y pipeline de postulaciones tipo kanban',
  ],
} as const
const beneficios = computed(() => BENEFICIOS[planSeleccionado.value])

const email           = ref('')
const password        = ref('')
const confirmPassword = ref('')
const loading         = ref(false)
const error           = ref('')
const success         = ref(false)
const verPass         = ref(false)
const verConfirm      = ref(false)
const aceptaTerminos  = ref(false)

// Sugerencia de corrección de typos en el dominio del correo (estilo Mailcheck).
// Solo sugiere cuando el dominio escrito está muy cerca de un proveedor común,
// para no molestar a quien usa un dominio corporativo legítimo.
const DOMINIOS_COMUNES = [
  'gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'yahoo.es',
  'icloud.com', 'live.com', 'live.cl', 'hotmail.es', 'hotmail.cl',
  'gmail.cl', 'me.com', 'protonmail.com',
]

function distanciaEdicion(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }
  return dp[m][n]
}

const emailSugerencia = computed<string | null>(() => {
  const v = email.value.trim().toLowerCase()
  const at = v.lastIndexOf('@')
  if (at < 1 || at === v.length - 1) return null
  const local = v.slice(0, at)
  const dom = v.slice(at + 1)
  if (!dom.includes('.') || DOMINIOS_COMUNES.includes(dom)) return null

  let mejor: string | null = null
  let mejorDist = Infinity
  for (const d of DOMINIOS_COMUNES) {
    const dist = distanciaEdicion(dom, d)
    if (dist < mejorDist) { mejorDist = dist; mejor = d }
  }
  // Cerca de un proveedor común → typo probable. Lejos → dominio propio, no sugerir.
  return mejor && mejorDist >= 1 && mejorDist <= 2 ? `${local}@${mejor}` : null
})

const passwordRules = computed(() => [
  { label: 'Mínimo 8 caracteres',    ok: password.value.length >= 8 },
  { label: 'Una mayúscula',          ok: /[A-Z]/.test(password.value) },
  { label: 'Una minúscula',          ok: /[a-z]/.test(password.value) },
  { label: 'Un número',              ok: /[0-9]/.test(password.value) },
  { label: 'Un carácter especial',   ok: /[^A-Za-z0-9]/.test(password.value) },
])

const passwordValida = computed(() => passwordRules.value.every(r => r.ok))

async function handleRegistro() {
  error.value = ''

  if (!passwordValida.value) {
    error.value = 'La contraseña no cumple los requisitos de seguridad.'
    return
  }
  if (password.value !== confirmPassword.value) {
    error.value = 'Las contraseñas no coinciden'
    return
  }
  if (!aceptaTerminos.value) {
    error.value = 'Debes aceptar los términos y condiciones para continuar.'
    return
  }

  loading.value = true

  const { data, error: authError } = await supabase.auth.signUp({
    email: email.value,
    password: password.value,
  })

  if (authError) {
    // Detectar email ya registrado para ofrecer login con el plan preservado
    const msg = authError.message?.toLowerCase() ?? ''
    if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
      emailExistente.value = true
    } else {
      error.value = 'No se pudo crear la cuenta. Intenta de nuevo.'
    }
    loading.value = false
    return
  }

  // Guardar intención de plan vía endpoint server-side (no UPDATE directo,
  // así no falla silenciosamente si RLS bloquea o columna no existe).
  // Solo si eligió Starter; con Free no hay intención de pago.
  if (data.session && planSeleccionado.value !== 'free') {
    let intencionGuardada = false
    try {
      const res = await $fetch<{ ok: boolean }>('/api/intencion-plan', {
        method: 'POST',
        body: { plan: planSeleccionado.value },
      })
      intencionGuardada = res.ok === true
    } catch {
      intencionGuardada = false
    }

    // Fallback en localStorage para que onboarding pueda recuperarla
    if (!intencionGuardada) {
      try { localStorage.setItem('plan_intencion', planSeleccionado.value) } catch {}
    }
  }

  // El correo de bienvenida (+ aviso a admins) lo dispara un trigger server-side
  // en auth.users (migración 20260525000002). No se invoca desde el cliente para
  // no depender del navegador ni duplicar el envío.

  if (data.session) {
    router.push('/onboarding')
  } else {
    success.value = true
  }

  loading.value = false
}

const emailExistente = ref(false)
const loginUrl = computed(() => {
  return planSeleccionado.value !== 'free'
    ? `/login?plan=${planSeleccionado.value}`
    : '/login'
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
  font-family: 'Inter', sans-serif;
  padding: 1.5rem;
}
.card {
  background: white;
  border-radius: 20px;
  width: 100%;
  max-width: 920px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.06);
  border: 1px solid #e2e8f0;
  overflow: hidden;
  display: grid;
  grid-template-columns: 1fr 1fr;
}

/* ── Panel izquierdo (landing) ───────────────────────────── */
.landing-panel {
  background: linear-gradient(160deg, #0ea5e9 0%, #0369a1 100%);
  color: white;
  padding: 2.5rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.lp-logo {
  height: 38px;
  width: auto;
  align-self: flex-start;
}
.lp-intro { display: flex; flex-direction: column; gap: 0.5rem; }
.lp-headline {
  font-size: 1.4rem;
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: -0.02em;
}
.lp-sub {
  font-size: 0.9rem;
  color: rgba(255,255,255,0.85);
  line-height: 1.45;
}

/* Selector de plan (segmented) */
.seg {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.4rem;
  background: rgba(255,255,255,0.14);
  border-radius: 12px;
  padding: 0.3rem;
}
.seg-btn {
  width: auto !important;
  margin: 0 !important;
  display: flex !important;
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
  padding: 0.55rem 0.5rem !important;
  background: transparent !important;
  color: rgba(255,255,255,0.85) !important;
  border: none;
  border-radius: 9px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.seg-btn:hover:not(.active) { background: rgba(255,255,255,0.08) !important; }
.seg-btn.active {
  background: white !important;
  color: #0369a1 !important;
  box-shadow: 0 1px 4px rgba(0,0,0,0.12);
}
.seg-name { font-weight: 700; font-size: 0.9rem; }
.seg-price { font-weight: 800; font-size: 0.95rem; }
.seg-price small { font-size: 0.65rem; font-weight: 600; opacity: 0.7; }

/* Beneficios dinámicos */
.lp-benefits {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.lp-benefits li {
  position: relative;
  padding-left: 1.6rem;
  font-size: 0.875rem;
  line-height: 1.4;
  color: rgba(255,255,255,0.95);
}
.lp-benefits li::before {
  content: '✓';
  position: absolute;
  left: 0;
  top: 0;
  width: 1.1rem;
  height: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.22);
  border-radius: 50%;
  font-size: 0.7rem;
  font-weight: 800;
}

/* Upsell (Free) / reaseguro (Starter) */
.lp-upsell {
  width: 100% !important;
  margin: 0 !important;
  text-align: left;
  background: rgba(255,255,255,0.12) !important;
  color: white !important;
  border: 1px solid rgba(255,255,255,0.25);
  border-radius: 10px;
  padding: 0.7rem 0.85rem !important;
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.35;
  cursor: pointer;
  transition: background 0.15s;
}
.lp-upsell:hover { background: rgba(255,255,255,0.2) !important; }
.lp-reassurance {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  background: rgba(255,255,255,0.12);
  border-radius: 10px;
  padding: 0.7rem 0.85rem;
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.35;
}
.lp-reassurance::before {
  content: '✓';
  font-weight: 800;
}

/* Cómo funciona */
.lp-steps {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  margin-top: auto;
}
.lp-step {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.82rem;
  color: rgba(255,255,255,0.9);
}
.lp-step-num {
  flex-shrink: 0;
  width: 1.4rem;
  height: 1.4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.2);
  border-radius: 50%;
  font-size: 0.75rem;
  font-weight: 800;
}
.lp-trust {
  font-size: 0.78rem;
  color: rgba(255,255,255,0.75);
  line-height: 1.4;
  border-top: 1px solid rgba(255,255,255,0.18);
  padding-top: 1rem;
}

/* ── Panel derecho (formulario) ──────────────────────────── */
.form-panel { padding: 2.5rem; }

h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.025em;
  margin-bottom: 0.375rem;
}
.subtitle {
  font-size: 0.9rem;
  color: #64748b;
  margin-bottom: 1.75rem;
}
.field { margin-bottom: 1rem; }
.email-hint {
  margin-top: 0.4rem;
  font-size: 0.78rem;
  color: #92400e;
}
.hint-btn {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  font-weight: 700;
  color: #b45309;
  text-decoration: underline;
  cursor: pointer;
}
label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.4rem;
}

/* Input con ojito */
.input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.input-wrap input { padding-right: 2.5rem; }
.eye-btn {
  position: absolute;
  right: 0.75rem;
  background: none !important;
  border: none;
  padding: 0;
  width: auto !important;
  margin: 0 !important;
  color: #94a3b8;
  cursor: pointer;
  display: flex;
  align-items: center;
  transform: none !important;
  line-height: 1;
}
.eye-btn:hover { color: #64748b; background: none !important; }

input {
  width: 100%;
  padding: 0.6875rem 0.875rem;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  font-size: 0.9375rem;
  font-family: inherit;
  color: #0f172a;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  background: #fafafa;
}
input:focus {
  border-color: #0ea5e9;
  box-shadow: 0 0 0 3px rgba(14,165,233,0.12);
  background: white;
}
input:disabled { opacity: 0.6; }

/* Reglas de contraseña */
.password-rules {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.75rem;
  margin-top: 0.5rem;
}
.rule {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  font-weight: 500;
  transition: color 0.2s;
}
.rule.pending { color: #94a3b8; }
.rule.ok      { color: #16a34a; }

/* Términos */
.terms-check {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  margin: 1rem 0;
  cursor: pointer;
  font-size: 0.8375rem;
  color: #64748b;
  line-height: 1.5;
  font-weight: 400;
}
.terms-check input[type="checkbox"] { display: none; }
.check-box {
  width: 17px; height: 17px;
  min-width: 17px;
  border: 1.5px solid #cbd5e1;
  border-radius: 4px;
  margin-top: 1px;
  transition: all 0.15s;
  position: relative;
  background: white;
}
.terms-check input:checked + .check-box {
  background: #0ea5e9;
  border-color: #0ea5e9;
}
.terms-check input:checked + .check-box::after {
  content: '';
  position: absolute;
  left: 3px; top: 1px;
  width: 6px; height: 9px;
  border: 2px solid white;
  border-top: none;
  border-left: none;
  transform: rotate(45deg);
}
.terms-check a {
  color: #0ea5e9;
  text-decoration: none;
  font-weight: 500;
}
.terms-check a:hover { text-decoration: underline; }

.error-banner {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  font-size: 0.875rem;
  padding: 0.625rem 0.875rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}
.success-banner {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #15803d;
  padding: 1rem;
  border-radius: 12px;
  margin-bottom: 1rem;
  font-size: 0.875rem;
  line-height: 1.5;
}
.success-icon {
  width: 28px; height: 28px;
  border-radius: 50%;
  background: #22c55e;
  color: white;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700;
  flex-shrink: 0;
}
.success-banner strong { display: block; margin-bottom: 0.25rem; font-size: 0.9rem; }

.info-banner {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1e40af;
  padding: 1rem;
  border-radius: 12px;
  margin-bottom: 1rem;
  font-size: 0.875rem;
  line-height: 1.5;
}
.info-icon {
  width: 28px; height: 28px;
  border-radius: 50%;
  background: #2563eb;
  color: white;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700;
  flex-shrink: 0;
  font-style: italic;
}
.info-banner strong { display: block; margin-bottom: 0.25rem; font-size: 0.9rem; }
.info-banner p { margin-bottom: 0.75rem; }
.btn-login-existente {
  display: inline-flex; align-items: center; gap: 0.4rem;
  background: #2563eb; color: white; padding: 0.5rem 0.875rem;
  border-radius: 8px; text-decoration: none; font-weight: 600;
  font-size: 0.8125rem; margin-right: 0.5rem;
  transition: background 0.15s;
}
.btn-login-existente:hover { background: #1d4ed8; }
.btn-otro-email {
  width: auto !important; padding: 0.5rem 0.875rem !important;
  background: transparent !important; color: #1e40af !important;
  font-size: 0.8125rem !important; font-weight: 600 !important;
  border: 1px solid #bfdbfe !important;
}
.btn-otro-email:hover:not(:disabled) {
  background: #dbeafe !important;
}

.btn-submit {
  width: 100%;
  padding: 0.75rem;
  background: #0ea5e9;
  color: white;
  font-size: 0.9375rem;
  font-weight: 600;
  font-family: inherit;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  margin-top: 0.5rem;
  transition: background 0.15s, transform 0.1s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}
.btn-submit:hover:not(:disabled) { background: #0284c7; }
.btn-submit:active:not(:disabled) { transform: scale(0.99); }
.btn-submit:disabled { opacity: 0.65; cursor: not-allowed; }
.spinner {
  width: 15px; height: 15px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.65s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.footer-link {
  text-align: center;
  margin-top: 1.5rem;
  font-size: 0.875rem;
  color: #94a3b8;
}
.footer-link a {
  color: #0ea5e9;
  text-decoration: none;
  font-weight: 500;
}
.footer-link a:hover { text-decoration: underline; }

/* ── Responsive ──────────────────────────────────────────── */
@media (max-width: 900px) {
  .card {
    grid-template-columns: 1fr;
    max-width: 460px;
  }
  .landing-panel {
    padding: 2rem 1.75rem;
    gap: 1rem;
  }
  .lp-headline { font-size: 1.2rem; }
  /* Cómo funciona ocupa mucho en móvil: se oculta para no empujar el form */
  .lp-steps { display: none; }
  .lp-trust { display: none; }
  .form-panel { padding: 2rem 1.75rem; }
}
@media (max-width: 560px) {
  .page { padding: 0; align-items: flex-start; }
  .card { border-radius: 0; border: none; min-height: 100vh; }
  .landing-panel { padding: 1.75rem 1.5rem; }
  .form-panel { padding: 1.75rem 1.5rem; }
}
</style>
