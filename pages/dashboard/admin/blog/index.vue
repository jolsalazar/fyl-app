<template>
  <NuxtLayout name="dashboard">
    <div class="content">
      <div class="header">
        <div>
          <h1>Blog</h1>
          <p class="subtitle">Entradas de fondosylicitaciones.cl/blog</p>
        </div>
        <NuxtLink to="/dashboard/admin/blog/nuevo" class="btn-primary">+ Nueva entrada</NuxtLink>
      </div>

      <div class="table-wrap">
        <div v-if="loading" class="loading">Cargando…</div>
        <div v-else-if="loadError" class="error">No se pudieron cargar las entradas. Intenta recargar la página.</div>
        <div v-else-if="!posts.length" class="loading">Todavía no hay entradas. Crea la primera.</div>
        <template v-else>
          <div class="table-head">
            <span>Entrada</span>
            <span class="col-cat">Categoría</span>
            <span class="col-fecha">Publicación</span>
            <span class="col-estado">Estado</span>
          </div>
          <NuxtLink
            v-for="p in posts"
            :key="p.id"
            :to="`/dashboard/admin/blog/${p.id}`"
            class="post-row"
            :class="{ borrador: p.estado === 'borrador' }"
          >
            <div class="post-info">
              <span class="post-title">{{ p.title }}</span>
              <span class="post-slug">/blog/{{ p.slug }}/</span>
            </div>
            <span class="col-cat cat-chip">{{ p.category }}</span>
            <span class="col-fecha fecha">{{ formatFecha(p.pub_date) }}</span>
            <span class="col-estado">
              <span class="estado-chip" :class="p.estado">
                {{ p.estado === 'publicado' ? 'Publicado' : 'Borrador' }}
              </span>
            </span>
          </NuxtLink>
        </template>
      </div>
    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'], layout: false })

const supabase = useSupabaseClient()

interface PostRow {
  id: string
  slug: string
  title: string
  category: string
  estado: string
  pub_date: string
}

const posts     = ref<PostRow[]>([])
const loading   = ref(true)
const loadError = ref(false)

onMounted(async () => {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('id, slug, title, category, estado, pub_date')
    .order('pub_date', { ascending: false })

  if (error) loadError.value = true
  else posts.value = (data ?? []) as PostRow[]

  loading.value = false
})

function formatFecha (v: string | null) {
  if (!v) return '—'
  const [y, m, d] = v.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-CL', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.content { flex: 1; padding: 2rem 2.5rem; font-family: 'Inter', sans-serif; }
.header { margin-bottom: 1.75rem; display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
h1 { font-size: 1.625rem; font-weight: 700; color: #0f172a; letter-spacing: -0.025em; }
.subtitle { font-size: 0.875rem; color: #64748b; margin-top: 0.2rem; }

.btn-primary {
  background: #0ea5e9; color: white; border: none; text-decoration: none;
  padding: 0.6rem 1.1rem; border-radius: 10px; font-size: 0.875rem; font-weight: 600;
  cursor: pointer; white-space: nowrap;
}
.btn-primary:hover { background: #0284c7; }

.table-wrap { background: white; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }

.table-head {
  display: grid;
  grid-template-columns: 1fr 140px 140px 110px;
  padding: 0.625rem 1.25rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  font-size: 0.75rem; font-weight: 700; color: #475569;
  text-transform: uppercase; letter-spacing: 0.04em; gap: 0.5rem;
}

.post-row {
  display: grid;
  grid-template-columns: 1fr 140px 140px 110px;
  align-items: center;
  padding: 0.875rem 1.25rem;
  border-bottom: 1px solid #f1f5f9;
  gap: 0.5rem;
  text-decoration: none;
  transition: background 0.15s;
}
.post-row:last-child { border-bottom: none; }
.post-row:hover { background: #f8fafc; }
.post-row.borrador { opacity: 0.65; }

.post-info { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
.post-title { font-size: 0.9375rem; font-weight: 600; color: #0f172a; }
.post-slug { font-size: 0.75rem; color: #94a3b8; font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.cat-chip { font-size: 0.8125rem; color: #475569; }
.fecha { font-size: 0.8125rem; color: #64748b; }

.estado-chip { font-size: 0.75rem; font-weight: 700; padding: 0.15rem 0.55rem; border-radius: 6px; }
.estado-chip.publicado { background: #f0fdf4; color: #16a34a; }
.estado-chip.borrador  { background: #fef3c7; color: #b45309; }

.loading, .error { padding: 3rem; text-align: center; color: #64748b; font-size: 0.9rem; }
.error { color: #ef4444; }

@media (max-width: 720px) {
  .content { padding: 1.25rem; }
  .table-head { display: none; }
  .post-row { grid-template-columns: 1fr; gap: 0.35rem; }
}
</style>
