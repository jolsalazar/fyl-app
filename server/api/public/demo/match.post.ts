// Endpoint público (sin auth) para el wizard de demo de la landing.
// Reusa el matcher de shared/match.ts (single source of truth) para que el demo
// refleje exactamente la misma lógica de scoring que ve un usuario registrado.
//
// Devuelve top-3 fondos abiertos según el perfil declarado, junto con el total
// disponible — la landing usa ese contador como anzuelo para el registro
// ("hay 47 fondos compatibles, te mostramos los 3 mejores").
//
// CORS abierto sólo a https://fondosylicitaciones.cl. Rate limiting se aplica
// en Cloudflare (Rate Limiting Rules), no en código.
//
// POST /api/public/demo/match
// Body: { tipo_persona, estado_proyecto, foco[], alcance[], monto_minimo }
// → 200 { ok, resultados: [...], total_disponibles, total_compatibles_alto }
// → 400 si el perfil es insuficiente
// → 500 si falla la lectura de convocatorias

import { serverSupabaseServiceRole } from '#supabase/server'
import { calcularMatch, type Perfil } from '~/shared/match'

const ALLOWED_ORIGIN = 'https://fondosylicitaciones.cl'
const MAX_CONVOCATORIAS = 500
const TOP_N = 3

const TIPO_PERSONA    = new Set(['natural', 'juridica'])
const ESTADO_PROYECTO = new Set(['solo_idea', 'maqueta', 'prototipo', 'marcha_blanca', 'crecimiento'])
const ALCANCE         = new Set(['regional', 'nacional', 'internacional'])
const MONTO           = new Set(['hasta_1M', '1M_10M', '10M_30M', '30M_60M', '60M_100M', 'sobre_100M'])

export default defineEventHandler(async (event) => {
  setHeader(event, 'Access-Control-Allow-Origin', ALLOWED_ORIGIN)
  setHeader(event, 'Access-Control-Allow-Methods', 'POST, OPTIONS')
  setHeader(event, 'Access-Control-Allow-Headers', 'Content-Type')
  setHeader(event, 'Access-Control-Max-Age', '3600')
  setHeader(event, 'Vary', 'Origin')

  if (event.method === 'OPTIONS') {
    setResponseStatus(event, 204)
    return ''
  }

  const body = await readBody<{
    tipo_persona?:    string | null
    estado_proyecto?: string | null
    foco?:            unknown
    alcance?:         unknown
    monto_minimo?:    string | null
  }>(event) ?? {}

  const perfil: Perfil = {
    tipo_persona:    TIPO_PERSONA.has(body.tipo_persona as string)       ? (body.tipo_persona as string)    : null,
    estado_proyecto: ESTADO_PROYECTO.has(body.estado_proyecto as string) ? (body.estado_proyecto as string) : null,
    foco:            Array.isArray(body.foco)
                        ? body.foco.filter((f): f is string => typeof f === 'string').slice(0, 5)
                        : [],
    alcance:         Array.isArray(body.alcance)
                        ? body.alcance.filter((a): a is string => typeof a === 'string' && ALCANCE.has(a)).slice(0, 3)
                        : [],
    monto_minimo:    MONTO.has(body.monto_minimo as string) ? (body.monto_minimo as string) : null,
  }

  // Necesitamos al menos algo para matchear, si no el score es ruido.
  if (!perfil.tipo_persona && !perfil.estado_proyecto && perfil.foco.length === 0) {
    setResponseStatus(event, 400)
    return { ok: false, error: 'insufficient_profile' }
  }

  const supabase = serverSupabaseServiceRole(event)
  const hoy = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('convocatorias')
    .select(`
      id, titulo, organizador, fuente,
      monto_rango, fecha_cierre_postulacion, alcance,
      foco, perfil_tipo_persona, perfil_nivel_desarrollo,
      perfil_nivel_ventas, perfil_antiguedad_empresa,
      link_postulacion, link_bases
    `)
    .eq('estado', 'abierto')
    .neq('fuente', 'mercadopublico')
    .or(`fecha_cierre_postulacion.gte.${hoy},fecha_cierre_postulacion.is.null`)
    .limit(MAX_CONVOCATORIAS)

  if (error || !data) {
    setResponseStatus(event, 500)
    return { ok: false, error: 'fetch_failed' }
  }

  const scored = data
    .map((conv: any) => ({ conv, match: calcularMatch(perfil, conv) }))
    .sort((a, b) => b.match.score - a.match.score)

  const totalCompatiblesAlto = scored.filter(s => s.match.nivel === 'alto').length

  const resultados = scored.slice(0, TOP_N).map(({ conv, match }) => ({
    titulo:       conv.titulo,
    organizador:  conv.organizador,
    fuente:       conv.fuente,
    monto_rango:  conv.monto_rango,
    fecha_cierre: conv.fecha_cierre_postulacion,
    alcance:      conv.alcance,
    link:         conv.link_bases || conv.link_postulacion || null,
    score:        match.score,
    nivel:        match.nivel,
    razones:      match.razones,
  }))

  return {
    ok: true,
    resultados,
    total_disponibles:        data.length,
    total_compatibles_alto:   totalCompatiblesAlto,
  }
})
