// Endpoint público (sin auth): detalle de UN fondo para su página SEO en ../fyl.
//
// Expone sólo el RESUMEN público (lo que rankea y da confianza). NO expone lo
// ACCIONABLE — link_postulacion, link_bases, requisitos_clave, criterios_evaluacion,
// documentacion_requerida, contacto — porque eso es el "detalle" que incentiva el
// registro (gate suave: la página pública lleva a crear cuenta gratis para verlo).
//
// CORS sólo a https://fondosylicitaciones.cl. Cache 6h en edge.
//
// GET /api/public/convocatorias/:id
// → 200 { ok, item: { …campos públicos… } }
// → 404 si no existe, está cerrado, o es de una fuente excluida.

import { serverSupabaseServiceRole } from '#supabase/server'

const ALLOWED_ORIGIN    = 'https://fondosylicitaciones.cl'
const CACHE_TTL_SECONDS = 21600 // 6h
const FUENTES_EXCLUIDAS = ['mercadopublico', 'adjudicaciones']

function slugify (s: string | null | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
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

  const id = getRouterParam(event, 'id')
  if (!id || !/^[a-f0-9]{8,32}$/i.test(id)) {
    setResponseStatus(event, 400)
    return { ok: false, error: 'invalid_id' }
  }

  const supabase = serverSupabaseServiceRole(event)
  const { data, error } = await supabase
    .from('convocatorias')
    .select('id, fuente, tipo, titulo, descripcion_breve, organizador, monto_rango, monto_maximo, tipo_financiamiento, alcance, region, foco, fecha_inicio_postulacion, fecha_cierre_postulacion, estado, updated_at')
    .eq('id', id)
    .single()

  if (error || !data) {
    setResponseStatus(event, 404)
    return { ok: false, error: 'not_found' }
  }

  const c = data as any

  // No servir páginas de fuentes excluidas ni fondos cerrados (evita indexar
  // contenido caduco; el usuario verá la versión cerrada solo si llega directo).
  if (FUENTES_EXCLUIDAS.includes(c.fuente)) {
    setResponseStatus(event, 404)
    return { ok: false, error: 'not_found' }
  }

  return {
    ok: true,
    item: {
      id:    c.id,
      slug:  `${slugify(c.titulo)}-${c.id}`,
      fuente: c.fuente,
      tipo:  c.tipo,
      titulo: c.titulo,
      descripcion_breve: c.descripcion_breve,
      organizador: c.organizador,
      monto_rango: c.monto_rango,
      monto_maximo: c.monto_maximo,
      tipo_financiamiento: c.tipo_financiamiento,
      alcance: c.alcance,
      region: c.region,
      foco:   c.foco ?? [],
      fecha_inicio_postulacion: c.fecha_inicio_postulacion,
      fecha_cierre_postulacion: c.fecha_cierre_postulacion,
      estado: c.estado,
      updated_at: c.updated_at,
    },
  }
})
