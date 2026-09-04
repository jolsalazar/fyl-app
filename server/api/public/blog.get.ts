// Endpoint público (sin auth): listado de posts PUBLICADOS del blog, para la
// página /blog del sitio público (../fyl) y para inyectar sus URLs al sitemap
// en tiempo de build.
//
// No devuelve body_html: el listado solo pinta tarjetas, y los cuerpos suman
// ~40KB entre todos. El cuerpo se pide por post en blog/[slug].get.ts.
//
// CORS sólo a https://fondosylicitaciones.cl. Cache 6h en edge.
//
// GET /api/public/blog?limit=200
// → 200 { ok, total, items: [{ slug, title, description, category, read_time,
//          hero_image, hero_image_thumb, hero_image_alt, pub_date, updated_date }] }

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

  const { limit: limitParam } = getQuery(event) as { limit?: string }
  const limit = Math.min(Math.max(parseInt(limitParam ?? '200', 10) || 200, 1), 500)

  const supabase = serverSupabaseServiceRole(event)

  const { data, error } = await supabase
    .from('blog_posts')
    .select('slug, title, description, category, read_time, hero_image, hero_image_thumb, hero_image_alt, pub_date, updated_date')
    .eq('estado', 'publicado')
    .order('pub_date', { ascending: false })
    .limit(limit)

  if (error || !data) {
    setResponseStatus(event, 500)
    return { ok: false, error: 'fetch_failed' }
  }

  return { ok: true, total: data.length, items: data }
})
