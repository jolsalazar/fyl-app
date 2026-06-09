<template>
  <div class="page">
    <div class="card">

      <!-- Panel izquierdo: marca (mismo molde que /registro, sin toggle ni features) -->
      <aside class="landing-panel">
        <span class="lp-logo-chip">
          <img src="~/assets/images/logo-light.png" alt="Fondos y Licitaciones" />
        </span>
        <h2 class="lp-headline">Tus oportunidades te están esperando</h2>
        <p class="lp-sub">Entra para ver novedades, cierres y el match de tus alertas.</p>
        <p class="lp-trust">Cada día sumamos nuevas oportunidades de financiamiento.</p>
      </aside>

      <!-- Panel derecho: formulario -->
      <div class="form-panel">
        <!-- Login -->
        <template v-if="!modoReset">
          <!-- Badge de plan si viene desde la web a contratar -->
          <div v-if="planQuery" class="plan-badge-login">
            <span>📦</span>
            Iniciar sesión para contratar Plan <strong>{{ planLabel }}</strong>
          </div>

          <h1>Bienvenido de vuelta</h1>
          <p class="subtitle">{{ planQuery ? 'Inicia sesión y continuamos con tu plan' : 'Ingresa a tu cuenta para ver tus alertas' }}</p>

          <form @submit.prevent="handleLogin">
            <div class="field">
              <label>Email</label>
              <input v-model="email" type="email" required placeholder="tu@empresa.cl" :disabled="loading" />
            </div>
            <div class="field">
              <label>Contraseña</label>
              <div class="input-wrap">
                <input v-model="password" :type="verPass ? 'text' : 'password'" required placeholder="••••••••" :disabled="loading" />
                <button type="button" class="eye-btn" @click="verPass = !verPass" tabindex="-1">
                  <svg v-if="!verPass" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                </button>
              </div>
            </div>

            <div v-if="error" class="error-banner">{{ error }}</div>

            <button type="submit" :disabled="loading">
              <span v-if="loading" class="spinner"></span>
              {{ loading ? 'Ingresando...' : 'Ingresar' }}
            </button>
          </form>

          <p class="footer-link">
            <button class="link-btn" @click="modoReset = true">¿Olvidaste tu contraseña?</button>
          </p>
          <p class="footer-link footer-registro">
            ¿No tienes cuenta? <NuxtLink to="/registro">Crear cuenta</NuxtLink>
          </p>
        </template>

        <!-- Recuperar contraseña -->
        <template v-else>
          <h1>Recuperar contraseña</h1>
          <p class="subtitle">Te enviamos un link para crear una nueva contraseña</p>

          <div v-if="resetEnviado" class="success-banner">
            <div class="success-icon">✓</div>
            <div>
              <strong>¡Revisa tu email!</strong>
              <p>Enviamos un link de recuperación a <strong>{{ email }}</strong>.</p>
            </div>
          </div>

          <form v-else @submit.prevent="handleReset">
            <div class="field">
              <label>Email</label>
              <input v-model="email" type="email" required placeholder="tu@empresa.cl" :disabled="loading" />
            </div>

            <div v-if="error" class="error-banner">{{ error }}</div>

            <button type="submit" :disabled="loading">
              <span v-if="loading" class="spinner"></span>
              {{ loading ? 'Enviando...' : 'Enviar link de recuperación' }}
            </button>
          </form>

          <p class="footer-link">
            <button class="link-btn" @click="modoReset = false; error = ''">← Volver al inicio de sesión</button>
          </p>
        </template>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { esPlanValido, PLANES_CONFIG, type Plan } from '~~/utils/planes'

const supabase = useSupabaseClient()
const router = useRouter()
const route = useRoute()
const { contratar: contratarPlan } = useContratarPlan()

const email    = ref('')
const password = ref('')
const verPass  = ref(false)
const loading  = ref(false)
const error = ref('')
const modoReset = ref(false)
const resetEnviado = ref(false)

// Plan desde query (cuando viene de /registro al detectar email existente, o desde la web)
const planQuery = computed<Plan | null>(() => {
  const p = route.query.plan as string
  return esPlanValido(p) && p !== 'free' ? p : null
})
const planLabel = computed(() => planQuery.value ? PLANES_CONFIG[planQuery.value].nombre : '')

async function handleLogin() {
  loading.value = true
  error.value = ''
  const { data, error: authError } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  })
  if (authError) {
    error.value = 'Email o contraseña incorrectos'
    loading.value = false
    return
  }

  // Si vino con ?plan=X, persistir intención y continuar al flujo correcto
  if (planQuery.value && data.user) {
    let intencionGuardada = false
    try {
      const res = await $fetch<{ ok: boolean }>('/api/intencion-plan', {
        method: 'POST',
        body: { plan: planQuery.value },
      })
      intencionGuardada = res.ok === true
    } catch {
      intencionGuardada = false
    }

    if (!intencionGuardada) {
      error.value = `No pudimos guardar tu intención de plan ${planLabel.value}. Reintenta o ve a "Planes" desde el dashboard.`
      loading.value = false
      return
    }

    // Si el usuario ya completó onboarding, ir directo al checkout de pago
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_done')
      .eq('id', data.user.id)
      .maybeSingle()

    if (profile?.onboarding_done) {
      const ok = await contratarPlan(planQuery.value)
      if (!ok) {
        // No dejar atrapado al usuario en "Ingresando..." si MP falla.
        // La intención ya quedó guardada, así que /planes recuperará la opción.
        error.value = 'No pudimos iniciar el pago. Te llevamos a Planes para reintentar.'
        loading.value = false
        setTimeout(() => router.push('/planes'), 1500)
      }
      return
    }

    // Sino, ir a onboarding (que detectará intended_plan al final)
    router.push('/onboarding')
    return
  }

  const next = route.query.next as string
  router.push(next && next.startsWith('/') ? next : '/dashboard')
  loading.value = false
}

async function handleReset() {
  loading.value = true
  error.value = ''
  const { error: authError } = await supabase.auth.resetPasswordForEmail(email.value, {
    redirectTo: 'https://app.fondosylicitaciones.cl/reset-password',
  })
  if (authError) {
    error.value = 'No se pudo enviar el email. Verifica la dirección.'
  } else {
    resetEnviado.value = true
  }
  loading.value = false
}
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
  max-width: 880px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.06);
  border: 1px solid #e2e8f0;
  overflow: hidden;
  display: grid;
  grid-template-columns: 1fr 1fr;
}

/* ── Panel izquierdo (marca) ─────────────────────────────── */
.landing-panel {
  background: linear-gradient(160deg, #0ea5e9 0%, #0369a1 100%);
  color: white;
  padding: 2.25rem 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.lp-logo-chip {
  align-self: flex-start;
  background: white;
  border-radius: 10px;
  padding: 0.45rem 0.7rem;
  line-height: 0;
  box-shadow: 0 1px 4px rgba(0,0,0,0.12);
}
.lp-logo-chip img { height: 24px; width: auto; display: block; }
.lp-headline {
  font-size: 1.35rem;
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: -0.02em;
}
.lp-sub {
  font-size: 0.9rem;
  color: rgba(255,255,255,0.85);
  line-height: 1.45;
}
.lp-trust {
  margin-top: auto;
  font-size: 0.78rem;
  color: rgba(255,255,255,0.78);
  line-height: 1.4;
  border-top: 1px solid rgba(255,255,255,0.18);
  padding-top: 0.9rem;
}

/* ── Panel derecho (formulario) ──────────────────────────── */
.form-panel { padding: 2.25rem; align-self: center; width: 100%; }

h1 {
  font-size: 1.4rem;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.025em;
  margin-bottom: 0.375rem;
}
.subtitle {
  font-size: 0.9rem;
  color: #64748b;
  margin-bottom: 1.5rem;
}
.field { margin-bottom: 1.125rem; }
label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.4rem;
  letter-spacing: 0.01em;
}
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
}
.eye-btn:hover { color: #64748b; background: none !important; }
.error-banner {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  font-size: 0.875rem;
  padding: 0.625rem 0.875rem;
  border-radius: 8px;
  margin-bottom: 1rem;
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
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  flex-shrink: 0;
}
.success-banner strong { display: block; margin-bottom: 0.25rem; font-size: 0.9rem; }
.plan-badge-login {
  display: flex; align-items: center; gap: 0.5rem;
  background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af;
  font-size: 0.8125rem; font-weight: 600;
  padding: 0.6rem 0.875rem; border-radius: 10px;
  margin-bottom: 1.25rem;
}
.plan-badge-login strong { font-weight: 800; }
.footer-link {
  text-align: center;
  margin-top: 1.5rem;
  font-size: 0.875rem;
}
.footer-registro {
  margin-top: 0.5rem;
  color: #94a3b8;
}
.footer-registro a {
  color: #0ea5e9;
  text-decoration: none;
  font-weight: 500;
}
.footer-registro a:hover { text-decoration: underline; }
.link-btn {
  display: inline !important;
  background: none !important;
  border: none;
  color: #0ea5e9;
  font-size: 0.875rem;
  font-family: inherit;
  cursor: pointer;
  padding: 0;
  width: auto;
  font-weight: 500;
  transform: none !important;
}
.link-btn:hover {
  background: none !important;
  color: #0284c7;
  text-decoration: underline;
}

/* ── Responsive ──────────────────────────────────────────── */
@media (max-width: 900px) {
  .card {
    grid-template-columns: 1fr;
    max-width: 440px;
  }
  .landing-panel {
    padding: 1.75rem;
    gap: 0.75rem;
  }
  .lp-headline { font-size: 1.2rem; }
  /* En móvil el reaseguro al pie empuja el form: se oculta */
  .lp-trust { display: none; }
  .form-panel { padding: 1.75rem; }
}
@media (max-width: 560px) {
  .page { padding: 0; align-items: flex-start; }
  .card { border-radius: 0; border: none; min-height: 100vh; }
  .landing-panel { padding: 1.75rem 1.5rem; }
  .form-panel { padding: 1.75rem 1.5rem; }
}
</style>
