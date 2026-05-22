// Endpoint público (sin auth): lista de fondos ABIERTOS para las páginas SEO de
// la web pública (../fyl) y el sitemap.
//
// Giro estratégico (vs /calendario/agregado, que solo daba conteos): acá SÍ
// exponemos el RESUMEN de cada fondo (título, organismo, rango de monto, cierre,
// descripción breve, foco) porque es lo que rankea en Google y trae tráfico —
// los fondos son programas públicos de gobierno, no info propietaria. Lo
// ACCIONABLE (link de postulación, requisitos completos, criterios) NO se expone
// acá: vive tras el registro en la app. Ver convocatorias/[id].get.ts.
//
// Excluye mercadopublico/adjudicaciones (títulos genéricos, bajo valor SEO).
// CORS sólo a https://fondosylicitaciones.cl. Cache 6h en edge.
//
// GET /api/public/convocatorias?limit=2000
// → 200 { ok, total, items: [{ id, slug, fuente, tipo, titulo, descripcion_breve,
//          monto_rango, alcance, region, foco, fecha_cierre_postulacion, updated_at }] }

import { serverSupabaseServiceRole } from '#supabase/server'

const ALLOWED_ORIGIN    = 'https://fondosylicitaciones.cl'
const CACHE_TTL_SECONDS = 21600 // 6h
const FUENTES_EXCLUIDAS = ['mercadopublico', 'adjudicaciones']

export function slugify (s: string | null | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // sin tildes
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '')
}

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
  const limit = Math.min(Math.max(parseInt(limitParam ?? '2000', 10) || 2000, 1), 5000)

  const hoy = new Date().toISOString().split('T')[0]
  const supabase = serverSupabaseServiceRole(event)

  const { data, error } = await supabase
    .from('convocatorias')
    .select('id, fuente, tipo, titulo, descripcion_breve, monto_rango, alcance, region, foco, fecha_cierre_postulacion, updated_at')
    .eq('estado', 'abierto')
    .not('fuente', 'in', `(${FUENTES_EXCLUIDAS.join(',')})`)
    .or(`fecha_cierre_postulacion.gte.${hoy},fecha_cierre_postulacion.is.null`)
    .order('fecha_cierre_postulacion', { ascending: true, nullsFirst: false })
    .limit(limit)

  if (error || !data) {
    setResponseStatus(event, 500)
    return { ok: false, error: 'fetch_failed' }
  }

  const items = (data as any[])
    .filter(c => c.titulo)
    .map(c => ({
      id:    c.id,
      slug:  `${slugify(c.titulo)}-${c.id}`,
      fuente: c.fuente,
      tipo:  c.tipo,
      titulo: c.titulo,
      descripcion_breve: c.descripcion_breve,
      monto_rango: c.monto_rango,
      alcance: c.alcance,
      region: c.region,
      foco:   c.foco ?? [],
      fecha_cierre_postulacion: c.fecha_cierre_postulacion,
      updated_at: c.updated_at,
    }))

  return { ok: true, total: items.length, items }
})
