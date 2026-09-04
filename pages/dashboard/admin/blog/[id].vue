<template>
  <NuxtLayout name="dashboard">
    <div class="content">
      <div class="header">
        <div>
          <NuxtLink to="/dashboard/admin/blog" class="back">← Blog</NuxtLink>
          <h1>{{ esNuevo ? 'Nueva entrada' : 'Editar entrada' }}</h1>
          <p v-if="!esNuevo && form" class="subtitle">
            <a :href="urlPublica" target="_blank" rel="noopener noreferrer">{{ urlPublica }}</a>
          </p>
        </div>
      </div>

      <div v-if="loading" class="loading">Cargando…</div>
      <div v-else-if="loadError" class="error">No se pudo cargar la entrada.</div>

      <form v-else-if="form" class="form" @submit.prevent="guardar">
        <section class="card">
          <div class="grid-2">
            <div class="field field-full">
              <label for="f-title">Título</label>
              <input id="f-title" v-model="form.title" type="text" class="text-input"
                     placeholder="ej: Fondos CORFO 2026: guía completa" required @blur="autoSlug" />
            </div>

            <div class="field field-full">
              <label for="f-slug">
                Slug
                <span class="hint">— la URL del artículo. No lo cambies en posts ya publicados.</span>
              </label>
              <div class="slug-row">
                <span class="slug-prefix">/blog/</span>
                <input id="f-slug" v-model="form.slug" type="text" class="text-input"
                       pattern="[a-z0-9\-]+" required />
                <span class="slug-prefix">/</span>
              </div>
            </div>

            <div class="field field-full">
              <label for="f-desc">
                Descripción
                <span class="hint">— bajada del artículo y meta description de Google ({{ form.description.length }} caracteres; ideal 120-160)</span>
              </label>
              <textarea id="f-desc" v-model="form.description" class="text-input" rows="3" required></textarea>
            </div>

            <div class="field">
              <label for="f-cat">Categoría</label>
              <input id="f-cat" v-model="form.category" type="text" class="text-input" list="categorias" required />
              <datalist id="categorias">
                <option v-for="c in CATEGORIAS" :key="c" :value="c" />
              </datalist>
            </div>

            <div class="field">
              <label for="f-read">Tiempo de lectura (min)</label>
              <input id="f-read" v-model.number="form.read_time" type="number" min="1" max="60" class="text-input" required />
            </div>

            <div class="field">
              <label for="f-pub">Fecha de publicación</label>
              <input id="f-pub" v-model="form.pub_date" type="date" class="text-input" required />
            </div>

            <div class="field">
              <label for="f-upd">
                Fecha de actualización
                <span class="hint">— opcional</span>
              </label>
              <input id="f-upd" v-model="form.updated_date" type="date" class="text-input" />
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card-header"><h2>Imagen destacada</h2></div>
          <p class="card-help">
            Se recorta a 3:2 y se generan dos versiones WebP: 1200px para el artículo
            y las redes sociales, 480px para la tarjeta del listado.
          </p>

          <div class="hero-row">
            <div class="hero-preview" :class="{ vacio: !form.hero_image }">
              <img v-if="form.hero_image" :src="form.hero_image" alt="" />
              <span v-else>Sin imagen</span>
            </div>
            <div class="hero-actions">
              <button type="button" class="btn-ghost" :disabled="subiendoHero" @click="heroInput?.click()">
                {{ subiendoHero ? 'Procesando…' : form.hero_image ? 'Reemplazar imagen' : 'Subir imagen' }}
              </button>
              <button v-if="form.hero_image" type="button" class="btn-ghost danger" @click="quitarHero">
                Quitar
              </button>
              <input ref="heroInput" type="file" accept="image/*" hidden @change="onHeroFile" />

              <div class="field">
                <label for="f-alt">Texto alternativo</label>
                <input id="f-alt" v-model="form.hero_image_alt" type="text" class="text-input"
                       placeholder="Describe la imagen para lectores de pantalla" />
              </div>
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card-header">
            <h2>Contenido</h2>
            <button type="button" class="btn-link" @click="mostrarPreview = !mostrarPreview">
              {{ mostrarPreview ? 'Volver al editor' : 'Vista previa' }}
            </button>
          </div>

          <div v-show="!mostrarPreview">
            <ClientOnly>
              <BlogEditor v-model="form.body_html" :slug="form.slug" />
              <template #fallback><div class="loading">Cargando editor…</div></template>
            </ClientOnly>
          </div>

          <div v-if="mostrarPreview" class="preview">
            <div class="prose" v-html="form.body_html"></div>
          </div>
        </section>

        <section class="card">
          <div class="card-header">
            <h2>Preguntas frecuentes</h2>
            <button type="button" class="btn-link" @click="agregarFaq">+ Agregar</button>
          </div>
          <p class="card-help">
            Se publican como bloque FAQ de schema.org: es lo que Google usa para mostrar
            las preguntas desplegables en los resultados de búsqueda.
          </p>

          <div v-if="!form.faqs.length" class="faq-vacio">Sin preguntas.</div>

          <div v-for="(faq, i) in form.faqs" :key="i" class="faq-item">
            <div class="faq-num">{{ i + 1 }}</div>
            <div class="faq-fields">
              <input v-model="faq.q" type="text" class="text-input" placeholder="Pregunta" />
              <textarea v-model="faq.a" class="text-input" rows="3" placeholder="Respuesta"></textarea>
            </div>
            <button type="button" class="faq-del" title="Eliminar" @click="form.faqs.splice(i, 1)">✕</button>
          </div>
        </section>

        <div class="actions">
          <button v-if="!esNuevo" type="button" class="btn-danger" @click="confirmarBorrado = true">
            Eliminar entrada
          </button>
          <div class="spacer"></div>

          <label class="estado-toggle">
            <input v-model="publicado" type="checkbox" />
            <span>Publicado</span>
          </label>

          <button type="submit" class="btn-primary" :disabled="guardando">
            {{ guardando ? 'Guardando…' : esNuevo ? 'Crear entrada' : 'Guardar cambios' }}
          </button>
        </div>
      </form>

      <ConfirmDialog
        :open="confirmarBorrado"
        title="Eliminar entrada"
        message="La entrada desaparecerá del blog. Esta acción no se puede deshacer."
        confirm-text="Eliminar"
        tone="danger"
        :busy="borrando"
        @confirm="eliminar"
        @cancel="confirmarBorrado = false"
      />
    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'], layout: false })

const supabase = useSupabaseClient()
const route    = useRoute()
const router   = useRouter()
const { show } = useToast()
const { subirHero } = useBlogImages()

const CATEGORIAS = ['Guías', 'Oportunidades', 'Análisis', 'Noticias']

interface Faq { q: string; a: string }
interface Form {
  slug: string
  title: string
  description: string
  category: string
  read_time: number
  body_html: string
  hero_image: string | null
  hero_image_thumb: string | null
  hero_image_alt: string | null
  faqs: Faq[]
  estado: string
  pub_date: string
  updated_date: string | null
}

const id      = computed(() => String(route.params.id))
const esNuevo = computed(() => id.value === 'nuevo')

const form            = ref<Form | null>(null)
const loading         = ref(true)
const loadError       = ref(false)
const guardando       = ref(false)
const borrando        = ref(false)
const subiendoHero    = ref(false)
const mostrarPreview  = ref(false)
const confirmarBorrado = ref(false)
const heroInput       = ref<HTMLInputElement>()

const publicado = computed({
  get: () => form.value?.estado === 'publicado',
  set: (v: boolean) => { if (form.value) form.value.estado = v ? 'publicado' : 'borrador' },
})

const urlPublica = computed(() =>
  form.value ? `https://fondosylicitaciones.cl/blog/${form.value.slug}/` : ''
)

/** Mismo algoritmo que slugify() en server/api/public/convocatorias.get.ts. */
function slugify (s: string): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '')
}

// Solo autocompleta mientras el slug esté vacío: nunca pisa el de un post ya
// creado, porque cambiarlo rompe la URL y los enlaces que apuntan a ella.
function autoSlug () {
  if (!form.value) return
  if (!form.value.slug && form.value.title) form.value.slug = slugify(form.value.title)
}

function vacio (): Form {
  const hoy = new Date().toISOString().slice(0, 10)
  return {
    slug: '', title: '', description: '', category: 'Guías', read_time: 5,
    body_html: '', hero_image: null, hero_image_thumb: null, hero_image_alt: null,
    faqs: [], estado: 'borrador', pub_date: hoy, updated_date: null,
  }
}

onMounted(async () => {
  if (esNuevo.value) {
    form.value = vacio()
    loading.value = false
    return
  }

  const { data, error } = await supabase
    .from('blog_posts')
    .select('slug, title, description, category, read_time, body_html, hero_image, hero_image_thumb, hero_image_alt, faqs, estado, pub_date, updated_date')
    .eq('id', id.value)
    .maybeSingle()

  if (error || !data) {
    loadError.value = true
  } else {
    const d = data as any
    form.value = {
      ...d,
      faqs: Array.isArray(d.faqs) ? d.faqs : [],
      pub_date: (d.pub_date ?? '').slice(0, 10),
      updated_date: d.updated_date ? d.updated_date.slice(0, 10) : null,
    }
  }
  loading.value = false
})

async function onHeroFile (e: Event) {
  const input = e.target as HTMLInputElement
  const file  = input.files?.[0]
  input.value = ''
  if (!file || !form.value) return

  if (!form.value.slug) {
    show('Escribe primero el título (define el nombre de la imagen)', 'error')
    return
  }

  subiendoHero.value = true
  try {
    const { hero, thumb } = await subirHero(file, form.value.slug)
    form.value.hero_image       = hero
    form.value.hero_image_thumb = thumb
    show('Imagen lista', 'ok')
  } catch (err: any) {
    show(err?.message ?? 'No se pudo subir la imagen', 'error')
  } finally {
    subiendoHero.value = false
  }
}

function quitarHero () {
  if (!form.value) return
  form.value.hero_image       = null
  form.value.hero_image_thumb = null
}

function agregarFaq () {
  form.value?.faqs.push({ q: '', a: '' })
}

async function guardar () {
  if (!form.value) return
  const f = form.value

  if (!/^[a-z0-9-]+$/.test(f.slug)) {
    show('El slug solo admite minúsculas, números y guiones', 'error')
    return
  }

  guardando.value = true

  const payload = {
    slug: f.slug,
    title: f.title.trim(),
    description: f.description.trim(),
    category: f.category.trim(),
    read_time: f.read_time,
    body_html: f.body_html,
    hero_image: f.hero_image,
    hero_image_thumb: f.hero_image_thumb,
    hero_image_alt: f.hero_image_alt?.trim() || null,
    // Descartamos las FAQs a medio escribir en vez de publicar entradas vacías.
    faqs: f.faqs.filter(x => x.q.trim() && x.a.trim()),
    estado: f.estado,
    pub_date: f.pub_date,
    updated_date: f.updated_date || null,
  }

  if (esNuevo.value) {
    const { data, error } = await supabase.from('blog_posts').insert(payload).select('id').single()
    if (error) {
      show(error.code === '23505' ? 'Ya existe una entrada con ese slug' : 'No se pudo crear la entrada', 'error')
    } else {
      show('Entrada creada', 'ok')
      await router.replace(`/dashboard/admin/blog/${(data as any).id}`)
    }
  } else {
    const { error } = await supabase.from('blog_posts').update(payload).eq('id', id.value)
    if (error) {
      show(error.code === '23505' ? 'Ya existe una entrada con ese slug' : 'No se pudo guardar', 'error')
    } else {
      show('Cambios guardados', 'ok')
    }
  }

  guardando.value = false
}

async function eliminar () {
  borrando.value = true
  const { error } = await supabase.from('blog_posts').delete().eq('id', id.value)
  borrando.value = false
  confirmarBorrado.value = false

  if (error) show('No se pudo eliminar', 'error')
  else await router.replace('/dashboard/admin/blog')
}
</script>

<!-- Sin scope: .prose debe alcanzar el HTML inyectado con v-html. -->
<style>
@import '~/assets/css/prose.css';
</style>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.content { flex: 1; padding: 2rem 2.5rem; font-family: 'Inter', sans-serif; max-width: 900px; }
.header { margin-bottom: 1.5rem; }
.back { font-size: 0.8125rem; color: #64748b; text-decoration: none; font-weight: 600; }
.back:hover { color: #0284c7; }
h1 { font-size: 1.625rem; font-weight: 700; color: #0f172a; letter-spacing: -0.025em; margin-top: 0.35rem; }
.subtitle { font-size: 0.8125rem; color: #64748b; margin-top: 0.2rem; font-family: monospace; }
.subtitle a { color: #0284c7; }

.form { display: flex; flex-direction: column; gap: 1.25rem; }

.card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.5rem; }
.card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; gap: 1rem; }
.card-header h2 { font-size: 1rem; font-weight: 700; color: #0f172a; }
.card-help { font-size: 0.8125rem; color: #64748b; margin-bottom: 1rem; line-height: 1.6; }

.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.field-full { grid-column: 1 / -1; }
.field { display: flex; flex-direction: column; gap: 0.35rem; }
.field label { font-size: 0.8125rem; font-weight: 600; color: #0f172a; }
.hint { font-weight: 400; color: #94a3b8; }

.text-input {
  width: 100%; padding: 0.625rem 0.875rem;
  border: 1.5px solid #e2e8f0; border-radius: 10px;
  font-size: 0.9rem; font-family: inherit; color: #0f172a;
  outline: none; transition: border-color 0.15s; background: white;
}
.text-input:focus { border-color: #0ea5e9; }
textarea.text-input { resize: vertical; line-height: 1.6; }

.slug-row { display: flex; align-items: center; gap: 0.35rem; }
.slug-prefix { font-family: monospace; font-size: 0.85rem; color: #94a3b8; }

.hero-row { display: flex; gap: 1.25rem; align-items: flex-start; flex-wrap: wrap; }
.hero-preview {
  width: 240px; aspect-ratio: 3 / 2; flex: 0 0 auto;
  border-radius: 10px; overflow: hidden; background: #f8fafc;
  border: 1.5px dashed #cbd5e1;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.8125rem; color: #94a3b8;
}
.hero-preview:not(.vacio) { border-style: solid; }
.hero-preview img { width: 100%; height: 100%; object-fit: cover; display: block; }
.hero-actions { flex: 1; min-width: 240px; display: flex; flex-direction: column; gap: 0.75rem; align-items: flex-start; }

.preview { border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 1.5rem 2rem; max-height: 70vh; overflow-y: auto; }

.faq-vacio { font-size: 0.875rem; color: #94a3b8; padding: 0.5rem 0; }
.faq-item { display: flex; gap: 0.75rem; align-items: flex-start; padding: 0.75rem 0; border-top: 1px solid #f1f5f9; }
.faq-num {
  flex: 0 0 auto; width: 24px; height: 24px; border-radius: 50%;
  background: #f1f5f9; color: #475569; font-size: 0.75rem; font-weight: 700;
  display: flex; align-items: center; justify-content: center; margin-top: 0.5rem;
}
.faq-fields { flex: 1; display: flex; flex-direction: column; gap: 0.5rem; min-width: 0; }
.faq-del { background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 0.9rem; padding: 0.5rem; }
.faq-del:hover { color: #dc2626; }

.actions {
  display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
  padding: 1rem 0 2rem;
}
.spacer { flex: 1; }

.estado-toggle { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; font-weight: 600; color: #0f172a; cursor: pointer; }
.estado-toggle input { width: 16px; height: 16px; accent-color: #0ea5e9; cursor: pointer; }

.btn-primary {
  background: #0ea5e9; color: white; border: none;
  padding: 0.65rem 1.4rem; border-radius: 10px;
  font-size: 0.875rem; font-weight: 600; cursor: pointer; font-family: inherit;
}
.btn-primary:hover:not(:disabled) { background: #0284c7; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-ghost {
  background: white; color: #0f172a; border: 1.5px solid #e2e8f0;
  padding: 0.55rem 1rem; border-radius: 10px;
  font-size: 0.8125rem; font-weight: 600; cursor: pointer; font-family: inherit;
}
.btn-ghost:hover:not(:disabled) { border-color: #cbd5e1; background: #f8fafc; }
.btn-ghost:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-ghost.danger { color: #dc2626; }

.btn-danger {
  background: white; color: #dc2626; border: 1.5px solid #fecaca;
  padding: 0.65rem 1.2rem; border-radius: 10px;
  font-size: 0.875rem; font-weight: 600; cursor: pointer; font-family: inherit;
}
.btn-danger:hover { background: #fef2f2; }

.btn-link { background: none; border: none; color: #0284c7; font-size: 0.8125rem; font-weight: 600; cursor: pointer; font-family: inherit; }

.loading, .error { padding: 3rem; text-align: center; color: #64748b; font-size: 0.9rem; }
.error { color: #ef4444; }

@media (max-width: 720px) {
  .content { padding: 1.25rem; }
  .grid-2 { grid-template-columns: 1fr; }
}
</style>
