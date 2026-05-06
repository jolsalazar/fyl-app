<template>
  <div class="page">
    <div class="card">
      <div class="brand">
        <img src="~/assets/images/logo-light.png" alt="Fondos y Licitaciones" class="brand-logo" />
      </div>

      <!-- Esperando sesión de recuperación -->
      <template v-if="!sessionLista && !listo">
        <div v-if="linkInvalido" class="error-banner">
          Este link ya no es válido o ha expirado.
          <NuxtLink to="/login" class="link-inline">Solicitar uno nuevo</NuxtLink>
        </div>
        <div v-else class="waiting">
          <span class="spinner-dark"></span>
          Verificando enlace…
        </div>
      </template>

      <template v-else-if="sessionLista && !listo">
        <h1>Nueva contraseña</h1>
        <p class="subtitle">Elige una contraseña segura para tu cuenta</p>

        <form @submit.prevent="handleUpdate">
          <div class="field">
            <label>Nueva contraseña</label>
            <input v-model="password" type="password" required placeholder="Mínimo 8 caracteres" minlength="8" :disabled="loading" />
          </div>
          <div class="field">
            <label>Confirmar contraseña</label>
            <input v-model="confirmPassword" type="password" required placeholder="Repite la contraseña" :disabled="loading" />
          </div>

          <div v-if="error" class="error-banner">{{ error }}</div>

          <button type="submit" :disabled="loading">
            <span v-if="loading" class="spinner"></span>
            {{ loading ? 'Guardando...' : 'Guardar contraseña' }}
          </button>
        </form>
      </template>

      <template v-else>
        <div class="success-banner">
          <div class="success-icon">✓</div>
          <div>
            <strong>¡Contraseña actualizada!</strong>
            <p>Ya puedes ingresar con tu nueva contraseña.</p>
          </div>
        </div>
        <NuxtLink to="/dashboard" class="btn-primary">Ir al dashboard</NuxtLink>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient()

const password        = ref('')
const confirmPassword = ref('')
const loading         = ref(false)
const error           = ref('')
const listo           = ref(false)
const sessionLista    = ref(false)
const linkInvalido    = ref(false)

onMounted(() => {
  // Esperar el evento PASSWORD_RECOVERY que dispara @nuxtjs/supabase
  // al intercambiar el ?code= del link de reset por una sesión válida
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY' && session) {
      sessionLista.value = true
    }
  })

  // Timeout: si en 8s no llega el evento, el link es inválido/expirado
  setTimeout(() => {
    if (!sessionLista.value && !listo.value) linkInvalido.value = true
  }, 8000)

  onUnmounted(() => subscription.unsubscribe())
})

async function handleUpdate() {
  error.value = ''
  if (password.value !== confirmPassword.value) {
    error.value = 'Las contraseñas no coinciden'
    return
  }
  loading.value = true
  const { error: authError } = await supabase.auth.updateUser({ password: password.value })
  if (authError) {
    error.value = 'No se pudo actualizar la contraseña. Intenta solicitar un nuevo link.'
  } else {
    listo.value = true
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
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.75rem;
}
.brand-logo {
  height: 50px;
  width: auto;
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
.field { margin-bottom: 1.125rem; }
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
  margin-bottom: 1.5rem;
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
button:disabled { opacity: 0.65; cursor: not-allowed; }
.btn-primary {
  display: block;
  text-align: center;
  padding: 0.75rem;
  background: #0ea5e9;
  color: white;
  font-size: 0.9375rem;
  font-weight: 600;
  border-radius: 10px;
  text-decoration: none;
  transition: background 0.15s;
}
.btn-primary:hover { background: #0284c7; }
.spinner {
  width: 15px; height: 15px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.65s linear infinite;
}
.spinner-dark {
  width: 18px; height: 18px;
  border: 2px solid #e2e8f0;
  border-top-color: #0ea5e9;
  border-radius: 50%;
  animation: spin 0.65s linear infinite;
  flex-shrink: 0;
}
.waiting {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.9rem;
  color: #64748b;
  padding: 0.5rem 0;
}
.link-inline {
  color: #0ea5e9;
  text-decoration: underline;
  margin-left: 0.25rem;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
