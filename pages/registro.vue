<template>
  <div class="page">
    <div class="card">
      <div class="brand">
        <span class="dot"></span>Fondos y Licitaciones
      </div>

      <!-- Plan badge -->
      <div v-if="plan" class="plan-badge" :class="plan">
        <span class="plan-icon">{{ planInfo.icon }}</span>
        Plan {{ planInfo.nombre }}
      </div>

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

      <form v-else @submit.prevent="handleRegistro">
        <div class="field">
          <label>Email</label>
          <input v-model="email" type="email" required placeholder="tu@empresa.cl" :disabled="loading" />
        </div>
        <div class="field">
          <label>Contraseña</label>
          <input v-model="password" type="password" required placeholder="Mínimo 8 caracteres" :disabled="loading" minlength="8" />
        </div>
        <div class="field">
          <label>Confirmar contraseña</label>
          <input v-model="confirmPassword" type="password" required placeholder="Repite tu contraseña" :disabled="loading" />
        </div>

        <div v-if="error" class="error-banner">{{ error }}</div>

        <button type="submit" :disabled="loading">
          <span v-if="loading" class="spinner"></span>
          {{ loading ? 'Creando cuenta...' : 'Crear cuenta' }}
        </button>
      </form>

      <p class="footer-link">
        ¿Ya tienes cuenta? <NuxtLink to="/login">Iniciar sesión</NuxtLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient()
const router = useRouter()
const route = useRoute()

const plan = computed(() => {
  const p = route.query.plan as string
  return ['free', 'starter', 'pro', 'agencia'].includes(p) ? p : null
})

const planInfo = computed(() => {
  const planes: Record<string, { nombre: string; icon: string }> = {
    free:    { nombre: 'Gratuito',  icon: '🌱' },
    starter: { nombre: 'Starter',  icon: '🚀' },
    pro:     { nombre: 'Pro',      icon: '⭐' },
    agencia: { nombre: 'Agencia',  icon: '🏢' },
  }
  return planes[plan.value ?? 'free']
})

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref('')
const success = ref(false)

async function handleRegistro() {
  error.value = ''

  if (password.value !== confirmPassword.value) {
    error.value = 'Las contraseñas no coinciden'
    return
  }

  loading.value = true

  const { data, error: authError } = await supabase.auth.signUp({
    email: email.value,
    password: password.value,
    options: {
      data: { plan: plan.value ?? 'free' },
    },
  })

  if (authError) {
    error.value = 'No se pudo crear la cuenta. Intenta de nuevo.'
    loading.value = false
    return
  }

  // Enviar email de bienvenida (fire & forget — no bloqueamos el flujo)
  if (data.user) {
    supabase.functions.invoke('send-welcome-email', {
      body: { record: { id: data.user.id } },
    }).catch(() => {})
  }

  // Si Supabase no requiere confirmación de email, redirige al onboarding
  if (data.session) {
    router.push('/onboarding')
  } else {
    success.value = true
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
  padding: 2.5rem;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.06);
  border: 1px solid #e2e8f0;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 1rem;
  font-weight: 800;
  color: #0f172a;
  margin-bottom: 1.25rem;
  letter-spacing: -0.02em;
}
.dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: #0ea5e9;
  box-shadow: 0 0 6px #0ea5e9;
}
.plan-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  font-weight: 700;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  margin-bottom: 1.25rem;
}
.plan-badge.free    { background: #f0fdf4; color: #16a34a; }
.plan-badge.pro     { background: #e0f2fe; color: #0284c7; }
.plan-badge.agencia { background: #eef2ff; color: #4338ca; }
.plan-trial { opacity: 0.75; }
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
label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: 0.4rem;
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
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  flex-shrink: 0;
}
.success-banner strong { display: block; margin-bottom: 0.25rem; font-size: 0.9rem; }
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
