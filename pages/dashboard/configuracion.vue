<template>
  <NuxtLayout name="dashboard">
    <div class="content">
      <div class="header">
        <div>
          <h1>Configuración</h1>
          <p class="subtitle">Seguridad de tu cuenta</p>
        </div>
      </div>

      <form class="form" @submit.prevent="cambiarPassword">
        <section class="card">
          <div class="card-header">
            <h2>Cambiar contraseña</h2>
          </div>
          <div class="field">
            <label>Nueva contraseña</label>
            <input v-model="nuevaPassword" type="password" placeholder="Mínimo 8 caracteres" minlength="8" :disabled="cambiando" />
          </div>
          <div class="field" style="margin-top:1rem">
            <label>Confirmar contraseña</label>
            <input v-model="confirmarPassword" type="password" placeholder="Repite la contraseña" :disabled="cambiando" />
          </div>
          <div v-if="mensaje" :class="['mensaje', error ? 'error' : 'ok']" style="margin-top:1rem">
            {{ mensaje }}
          </div>
        </section>
        <div class="actions">
          <button type="submit" :disabled="cambiando || !nuevaPassword">
            <span v-if="cambiando" class="spinner"></span>
            {{ cambiando ? 'Guardando...' : 'Cambiar contraseña' }}
          </button>
        </div>
      </form>
    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: false })

const supabase = useSupabaseClient()

const cambiando       = ref(false)
const nuevaPassword   = ref('')
const confirmarPassword = ref('')
const mensaje         = ref('')
const error           = ref(false)

async function cambiarPassword() {
  mensaje.value = ''
  if (nuevaPassword.value !== confirmarPassword.value) {
    error.value   = true
    mensaje.value = 'Las contraseñas no coinciden'
    return
  }
  cambiando.value = true
  const { error: err } = await supabase.auth.updateUser({ password: nuevaPassword.value })
  error.value   = !!err
  mensaje.value = err ? 'Error al cambiar la contraseña.' : '✓ Contraseña actualizada'
  if (!err) { nuevaPassword.value = ''; confirmarPassword.value = '' }
  cambiando.value = false
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.content { flex: 1; padding: 2.5rem; font-family: 'Inter', sans-serif; }
.header  { margin-bottom: 2rem; }
h1 { font-size: 1.625rem; font-weight: 700; color: #0f172a; letter-spacing: -0.025em; }
.subtitle { font-size: 0.9375rem; color: #64748b; margin-top: 0.2rem; }

.form { display: flex; flex-direction: column; gap: 1.25rem; max-width: 480px; }
.card { background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1.5rem; }
.card-header { margin-bottom: 1.25rem; }
.card-header h2 { font-size: 0.9375rem; font-weight: 700; color: #0f172a; }

.field label { display: block; font-size: 0.8125rem; font-weight: 600; color: #374151; margin-bottom: 0.4rem; }
.field input {
  width: 100%; padding: 0.6rem 0.75rem; border: 1.5px solid #e2e8f0;
  border-radius: 9px; font-size: 0.9rem; font-family: inherit; outline: none;
  transition: border-color 0.15s, box-shadow 0.15s; color: #0f172a;
}
.field input:focus { border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(14,165,233,0.1); }

.actions { display: flex; align-items: center; gap: 1rem; }
.mensaje { font-size: 0.875rem; font-weight: 500; padding: 0.5rem 0.875rem; border-radius: 8px; }
.mensaje.ok    { background: #f0fdf4; color: #16a34a; }
.mensaje.error { background: #fef2f2; color: #dc2626; }

button[type="submit"] {
  padding: 0.7rem 1.75rem; background: #0ea5e9; color: white; font-size: 0.9375rem;
  font-weight: 600; font-family: inherit; border: none; border-radius: 10px;
  cursor: pointer; transition: background 0.15s; display: flex; align-items: center; gap: 0.5rem;
}
button[type="submit"]:hover:not(:disabled) { background: #0284c7; }
button[type="submit"]:disabled { opacity: 0.6; cursor: not-allowed; }
.spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.65s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
