<template>
  <div class="page">
    <div class="card">
      <div class="brand">
        <span class="dot"></span>Fondos y Licitaciones
      </div>
      <h1>Bienvenido de vuelta</h1>
      <p class="subtitle">Ingresa a tu cuenta para ver tus alertas</p>

      <form @submit.prevent="handleLogin">
        <div class="field">
          <label>Email</label>
          <input v-model="email" type="email" required placeholder="tu@empresa.cl" :disabled="loading" />
        </div>
        <div class="field">
          <label>Contraseña</label>
          <input v-model="password" type="password" required placeholder="••••••••" :disabled="loading" />
        </div>

        <div v-if="error" class="error-banner">{{ error }}</div>

        <button type="submit" :disabled="loading">
          <span v-if="loading" class="spinner"></span>
          {{ loading ? 'Ingresando...' : 'Ingresar' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient()
const router = useRouter()

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  loading.value = true
  error.value = ''
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  })
  if (authError) {
    error.value = 'Email o contraseña incorrectos'
  } else {
    router.push('/dashboard')
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
  margin-bottom: 1.75rem;
  letter-spacing: -0.02em;
}
.dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: #0ea5e9;
  box-shadow: 0 0 6px #0ea5e9;
}
h1 {
  font-size: 1.625rem;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.025em;
  margin-bottom: 0.375rem;
}
.subtitle {
  font-size: 0.9375rem;
  color: #64748b;
  margin-bottom: 2rem;
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
</style>
