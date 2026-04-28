<template>
  <div class="redir">
    <div class="spinner"></div>
  </div>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient()
const route    = useRoute()
const router   = useRouter()

onMounted(async () => {
  const to      = route.query.to as string
  const alertaId = route.query.alerta as string | undefined
  const convId   = route.query.conv as string | undefined

  // Registrar click si hay convocatoria
  if (convId) {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('email_clicks').insert({
      user_id:         user?.id ?? null,
      convocatoria_id: convId,
      alerta_id:       alertaId ?? null,
      fuente:          'email_alert',
    })
  }

  // Redirigir — si no hay destino válido, va al dashboard
  const dest = to && to.startsWith('/') ? to : '/dashboard'
  router.replace(dest)
})
</script>

<style scoped>
.redir {
  min-height: 100vh; display: flex;
  align-items: center; justify-content: center;
  background: #f1f5f9;
}
.spinner {
  width: 28px; height: 28px;
  border: 3px solid #e2e8f0; border-top-color: #0ea5e9;
  border-radius: 50%; animation: spin 0.65s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
