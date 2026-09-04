// Endpoint público (sin auth): un post del blog completo, para su página SEO
// en ../fyl (/blog/<slug>/).
//
// A diferencia de las convocatorias, acá NO hay gate: el contenido del blog es
// íntegramente público — es el que rankea y trae el tráfico. El body viene como
// HTML ya renderizado (el admin de la app escribe con un editor WYSIWYG).
//
// CORS sólo a https://fondosylicitaciones.cl. Cache 6h en edge.
//
// GET /api/public/blog/:slug
// → 200 { ok, item: { slug, title, description, category, read_time, body_html,
//          hero_image, hero_image_thumb, hero_image_alt, faqs, pub_date, updated_date } }
// → 404 si no existe o está en borrador.

import { serverSupabaseServiceRole } from '#supabase/server'

const ALLOWED_ORIGIN    = 'https://fondosylicitaciones.cl'
const CACHE_TTL_SECONDS = 21600 // 6h

export default defineEventHandler(async (event) => {
  setHeader(event, 'Access-Control-Allow-Origin',  ALLOWED_ORIGIN)
  setHeader(event, 'Access-Control-Allow-Methods', 'GET, OPTIONS')
  setHeader(event, 'Access-Control-Max-Age',       '3600')
  setHeader(event, 'Vary',                          'Origin')
  setHeader(event, 'Cache-Control',                 `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}`)

  if (event.method === 'OPTIONS') {
    setResponseStatus(event, 204)
    return ''
  }

  const slug = getRouterParam(event, 'slug')
  if (!slug || !/^[a-z0-9-]{1,120}$/.test(slug)) {
    setResponseStatus(event, 400)
    return { ok: false, error: 'invalid_slug' }
  }

  const supabase = serverSupabaseServiceRole(event)

  const { data, error } = await supabase
    .from('blog_posts')
    .select('slug, title, description, category, read_time, body_html, hero_image, hero_image_thumb, hero_image_alt, faqs, pub_date, updated_date')
    .eq('slug', slug)
    .eq('estado', 'publicado')
    .maybeSingle()

  if (error || !data) {
    setResponseStatus(event, 404)
    return { ok: false, error: 'not_found' }
  }

  const p = data as any

  return {
    ok: true,
    item: {
      ...p,
      faqs: Array.isArray(p.faqs) ? p.faqs : [],
    },
  }
})
