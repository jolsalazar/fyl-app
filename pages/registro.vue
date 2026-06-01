<template>
  <div class="page">
    <div class="card">
      <div class="brand">
        <img src="~/assets/images/logo-light.png" alt="Fondos y Licitaciones" class="brand-logo" />
      </div>

      <h1>Crea tu cuenta</h1>
      <p class="subtitle">Empieza a recibir alertas de oportunidades en minutos</p>

      <!-- Selector de plan: momento de decisión Free vs Starter -->
      <div v-if="!success && !emailExistente" class="plan-selector">
        <button
          type="button"
          class="plan-option"
          :class="{ selected: planSeleccionado === 'free' }"
          @click="planSeleccionado = 'free'"
        >
          <span class="plan-option-head">
            <span class="plan-option-icon">{{ PLANES_CONFIG.free.icon }}</span>
            <span class="plan-option-name">{{ PLANES_CONFIG.free.nombre }}</span>
          </span>
          <span class="plan-option-price">$0<small>/mes</small></span>
          <span class="plan-option-desc">Explora oportunidades y recibe 1 alerta.</span>
        </button>

        <button
          type="button"
          class="plan-option featured"
          :class="{ selected: planSeleccionado === 'starter' }"
          @click="planSeleccionado = 'starter'"
        >
          <span class="plan-option-badge">⭐ Recomendado</span>
          <span class="plan-option-head">
            <span class="plan-option-icon">{{ PLANES_CONFIG.starter.icon }}</span>
            <span class="plan-option-name">{{ PLANES_CONFIG.starter.nombre }}</span>
          </span>
          <span class="plan-option-price">${{ PLANES_CONFIG.starter.precio.toLocaleString('es-CL') }}<small>/mes</small></span>
          <span class="plan-option-desc">Alertas diarias, Mi Match y herramientas de gestión.</span>
        </button>
      </div>

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

        <button type="submit" :disabled="loading || !passwordValida || !aceptaTerminos">
          <span v-if="loading" class="spinner"></span>
          {{ loading ? 'Creando cuenta...' : 'Crear cuenta' }}
        </button>
      </form>

      <p class="footer-link">
        ¿Ya tienes cuenta? <NuxtLink :to="loginUrl">Iniciar sesión</NuxtLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PLANES_CONFIG } from '~~/utils/planes'

const supabase = useSupabaseClient()
const router = useRouter()
const route = useRoute()

// Selector Free/Starter del registro. Se siembra con ?plan= si llega (free|starter),
// si no, default a Starter (el recomendado). Solo registra la intención: el cobro
// de Starter ocurre al final del onboarding.
const planQuery = route.query.plan as string
const planSeleccionado = ref<'free' | 'starter'>(planQuery === 'free' ? 'free' : 'starter')

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
  padding: 2.5rem;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.06);
  border: 1px solid #e2e8f0;
}
.brand {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.25rem;
}
.brand-logo { height: 50px; width: auto; }

/* Selector de plan Free/Starter */
.plan-selector {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.6rem;
  margin-bottom: 1.5rem;
}
.plan-selector .plan-option {
  position: relative;
  display: flex !important;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
  width: 100%;
  margin: 0 !important;
  padding: 0.85rem !important;
  background: white !important;
  color: #0f172a !important;
  border: 1.5px solid #e2e8f0 !important;
  border-radius: 12px;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.plan-selector .plan-option:hover { border-color: #cbd5e1 !important; }
.plan-selector .plan-option.selected {
  border-color: #0ea5e9 !important;
  box-shadow: 0 0 0 3px rgba(14,165,233,0.12);
}
.plan-option-head {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.plan-option-icon { font-size: 1.05rem; line-height: 1; }
.plan-option-name { font-weight: 700; font-size: 0.9rem; }
.plan-option-price { font-weight: 800; font-size: 1.05rem; color: #0f172a; }
.plan-option-price small { font-size: 0.7rem; font-weight: 600; color: #94a3b8; }
.plan-option-desc { font-size: 0.72rem; color: #64748b; line-height: 1.35; font-weight: 400; }
.plan-option-badge {
  position: absolute;
  top: -9px;
  right: 10px;
  background: #0ea5e9;
  color: white;
  font-size: 0.62rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  white-space: nowrap;
}

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

button {
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
button:hover:not(:disabled) { background: #0284c7; }
button:active:not(:disabled) { transform: scale(0.99); }
button:disabled { opacity: 0.65; cursor: not-allowed; }
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
</style>
