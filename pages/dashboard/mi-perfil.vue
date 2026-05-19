<template>
  <NuxtLayout name="dashboard">
    <div class="content">
      <div class="page-header">
        <div>
          <h1>Mis Proyectos</h1>
          <p class="subtitle">Configura tus proyectos para que el módulo de Mis Match calcule tu compatibilidad con cada fondo.</p>
        </div>
      </div>

      <ProyectosManager />
    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: false })
const { load: loadPlan } = usePlan()
onMounted(() => { loadPlan() })
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.content { flex: 1; padding: 2rem 2.5rem; font-family: 'Inter', sans-serif; max-width: 760px; }
.page-header { margin-bottom: 2rem; }
h1 { font-size: 1.625rem; font-weight: 700; color: #0f172a; letter-spacing: -0.025em; }
.subtitle { font-size: 0.875rem; color: #64748b; margin-top: 0.25rem; max-width: 520px; line-height: 1.55; }

@media (max-width: 640px) {
  .content { padding: 1.5rem 1rem; }
}
</style>
