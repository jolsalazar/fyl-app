<template>
  <NuxtLayout name="dashboard">
    <div class="content">
      <div class="header">
        <div>
          <h1>Mis Alertas</h1>
          <p class="subtitle">Oportunidades que coinciden con tu perfil</p>
        </div>
        <NuxtLink to="/dashboard/configuracion" class="btn-config">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          Configurar alertas
        </NuxtLink>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="empty">
        <div class="spinner"></div>
      </div>

      <!-- Empty state -->
      <div v-else-if="matches.length === 0" class="empty">
        <div class="empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6.002 6.002 0 0 0-4-5.659V5a2 2 0 1 0-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"/></svg>
        </div>
        <p class="empty-title">Sin alertas por ahora</p>
        <p class="empty-desc">Configura tus preferencias y recibirás oportunidades que se ajusten a tu perfil.</p>
        <NuxtLink to="/dashboard/configuracion" class="btn-primary">Configurar preferencias</NuxtLink>
      </div>

      <!-- Lista -->
      <div v-else class="lista">
        <div v-for="match in matches" :key="match.id" class="card">
          <div class="card-top">
            <span class="fuente">{{ match.opportunities.fuente }}</span>
            <span :class="['badge', match.visto ? 'badge-visto' : 'badge-nuevo']">
              {{ match.visto ? 'Visto' : 'Nuevo' }}
            </span>
          </div>
          <h3>{{ match.opportunities.titulo }}</h3>
          <p class="desc">{{ match.opportunities.descripcion }}</p>
          <div class="card-footer">
            <span class="cierre">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Cierra {{ formatFecha(match.opportunities.fecha_cierre) }}
            </span>
            <a :href="match.opportunities.url" target="_blank" class="ver-link">
              Ver convocatoria
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: false })

const supabase = useSupabaseClient()

const loading = ref(true)
const matches = ref<any[]>([])

onMounted(async () => {
  const { data: { user } } = await supabase.auth.getUser()
  const { data } = await supabase
    .from('alert_matches')
    .select('*, opportunities(*)')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })
  matches.value = data ?? []
  loading.value = false
})

function formatFecha(fecha: string) {
  if (!fecha) return '—'
  return new Date(fecha).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.content {
  flex: 1;
  padding: 2.5rem;
  font-family: 'Inter', sans-serif;
}
.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 2rem;
  gap: 1rem;
}
h1 {
  font-size: 1.625rem;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.025em;
}
.subtitle {
  font-size: 0.9375rem;
  color: #64748b;
  margin-top: 0.2rem;
}
.btn-config {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  background: white;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #475569;
  text-decoration: none;
  transition: all 0.15s;
  white-space: nowrap;
  font-family: 'Inter', sans-serif;
}
.btn-config:hover {
  border-color: #0ea5e9;
  color: #0ea5e9;
}
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 5rem 2rem;
  text-align: center;
  gap: 0.75rem;
}
.empty-icon {
  width: 64px; height: 64px;
  background: #f1f5f9;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.5rem;
}
.empty-title {
  font-size: 1.0625rem;
  font-weight: 600;
  color: #0f172a;
}
.empty-desc {
  font-size: 0.9375rem;
  color: #64748b;
  max-width: 340px;
  line-height: 1.55;
}
.btn-primary {
  display: inline-block;
  margin-top: 0.5rem;
  padding: 0.625rem 1.25rem;
  background: #0ea5e9;
  color: white;
  font-size: 0.9rem;
  font-weight: 600;
  border-radius: 10px;
  text-decoration: none;
  transition: background 0.15s;
  font-family: 'Inter', sans-serif;
}
.btn-primary:hover { background: #0284c7; }
.spinner {
  width: 28px; height: 28px;
  border: 3px solid #e2e8f0;
  border-top-color: #0ea5e9;
  border-radius: 50%;
  animation: spin 0.65s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.lista {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}
.card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 1.25rem 1.5rem;
  transition: box-shadow 0.15s, border-color 0.15s;
}
.card:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,0.06);
  border-color: #cbd5e1;
}
.card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}
.fuente {
  font-size: 0.75rem;
  font-weight: 700;
  color: #0ea5e9;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.badge {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}
.badge-nuevo { background: #e0f2fe; color: #0284c7; }
.badge-visto { background: #f1f5f9; color: #94a3b8; }
.card h3 {
  font-size: 1rem;
  font-weight: 600;
  color: #0f172a;
  margin-bottom: 0.375rem;
  line-height: 1.4;
}
.desc {
  font-size: 0.9rem;
  color: #64748b;
  line-height: 1.55;
}
.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1.125rem;
  padding-top: 1rem;
  border-top: 1px solid #f1f5f9;
}
.cierre {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  color: #94a3b8;
  font-weight: 500;
}
.ver-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.875rem;
  color: #0ea5e9;
  text-decoration: none;
  font-weight: 600;
  transition: gap 0.15s;
}
.ver-link:hover { gap: 0.55rem; }
</style>
