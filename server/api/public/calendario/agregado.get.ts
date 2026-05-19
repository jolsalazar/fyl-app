// Endpoint público (sin auth) para el reporte mensual agregado del ecosistema
// de fondos chilenos. Lo consume el post mensual del blog en la landing.
//
// Devuelve sólo agregados (conteos y porcentajes), nunca títulos ni links de
// fondos específicos — esto evita que el contenido sea "googleable" hacia los
// sitios oficiales y mantiene el incentivo de registro para ver el detalle.
//
// CORS abierto sólo a https://fondosylicitaciones.cl. Cache 6h en edge.
//
// GET /api/public/calendario/agregado?mes=YYYY-MM
// → 200 {
//     ok, mes, mes_label, total,
//     por_fuente:   { corfo: 12, sercotec: 8, … },
//     por_foco:     [{ nombre, count }, …]      (top 8),
//     por_monto:    { hasta_1M: 5, "1M_10M": 12, … },
//     por_alcance:  { regional: 8, nacional: 35, internacional: 4 },
//     urgentes_esta_semana: 6,
//     comparativa_mes_anterior: { total, diferencia, porcentaje } | null
//   }
// → 400 si el parámetro `mes` falta o tiene formato inválido
// → 500 si falla la lectura de convocatorias

import { serverSupabaseServiceRole } from '#supabase/server'

const ALLOWED_ORIGIN     = 'https://fondosylicitaciones.cl'
const CACHE_TTL_SECONDS  = 21600 // 6 horas
const FUENTES_EXCLUIDAS  = ['mercadopublico', 'adjudicaciones']
const FOCO_TOP_N         = 8

const MESES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function rangoMes (anio: number, mes: number): { inicio: string; fin: string } {
  const inicio = `${anio}-${String(mes).padStart(2, '0')}-01`
  // El día 0 del mes siguiente devuelve el último día del mes actual.
  const fin    = new Date(Date.UTC(anio, mes, 0)).toISOString().split('T')[0]
  return { inicio, fin }
}

export default defineEventHandler(async (event) => {
  setHeader(event, 'Access-Control-Allow-Origin',  ALLOWED_ORIGIN)
  setHeader(event, 'Access-Control-Allow-Methods', 'GET, OPTIONS')
  setHeader(event, 'Access-Control-Max-Age',       '3600')
  setHeader(event, 'Vary',                         'Origin')
  setHeader(event, 'Cache-Control',                `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}`)

  if (event.method === 'OPTIONS') {
    setResponseStatus(event, 204)
    return ''
  }

  const { mes: mesParam } = getQuery(event) as { mes?: string }

  if (!mesParam || !/^\d{4}-\d{2}$/.test(mesParam)) {
    setResponseStatus(event, 400)
    return { ok: false, error: 'invalid_mes_format' }
  }

  const [anioStr, mesStr] = mesParam.split('-')
  const anio = parseInt(anioStr, 10)
  const mes  = parseInt(mesStr, 10)

  if (mes < 1 || mes > 12 || anio < 2024 || anio > 2030) {
    setResponseStatus(event, 400)
    return { ok: false, error: 'invalid_mes_value' }
  }

  const { inicio, fin } = rangoMes(anio, mes)
  const supabase = serverSupabaseServiceRole(event)

  const { data, error } = await supabase
    .from('convocatorias')
    .select('fuente, foco, monto_rango, alcance, fecha_cierre_postulacion')
    .gte('fecha_cierre_postulacion', inicio)
    .lte('fecha_cierre_postulacion', fin)
    .not('fuente', 'in', `(${FUENTES_EXCLUIDAS.join(',')})`)
    .limit(5000)

  if (error || !data) {
    setResponseStatus(event, 500)
    return { ok: false, error: 'fetch_failed' }
  }

  // Agregaciones
  const por_fuente: Record<string, number>  = {}
  const por_foco_counts: Record<string, number> = {}
  const por_monto:  Record<string, number>  = {}
  const por_alcance: Record<string, number> = {}

  const hoy = new Date()
  hoy.setUTCHours(0, 0, 0, 0)
  const en7dias = new Date(hoy.getTime() + 7 * 86400000)

  let urgentes_esta_semana = 0

  for (const c of data as any[]) {
    if (c.fuente) por_fuente[c.fuente] = (por_fuente[c.fuente] ?? 0) + 1

    if (Array.isArray(c.foco)) {
      for (const f of c.foco) {
        if (typeof f === 'string' && f.length > 0) {
          por_foco_counts[f] = (por_foco_counts[f] ?? 0) + 1
        }
      }
    }

    if (c.monto_rango)  por_monto[c.monto_rango]   = (por_monto[c.monto_rango] ?? 0) + 1
    if (c.alcance)      por_alcance[c.alcance]     = (por_alcance[c.alcance] ?? 0) + 1

    if (c.fecha_cierre_postulacion) {
      const fc = new Date(c.fecha_cierre_postulacion + 'T00:00:00Z')
      if (fc >= hoy && fc <= en7dias) urgentes_esta_semana++
    }
  }

  const por_foco = Object.entries(por_foco_counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, FOCO_TOP_N)
    .map(([nombre, count]) => ({ nombre, count }))

  // Comparativa con mes anterior (un SELECT extra ligero, head: true)
  let comparativa_mes_anterior: { total: number; diferencia: number; porcentaje: number } | null = null
  const prevMes  = mes === 1 ? 12       : mes - 1
  const prevAnio = mes === 1 ? anio - 1 : anio
  if (prevAnio >= 2024) {
    const { inicio: prevInicio, fin: prevFin } = rangoMes(prevAnio, prevMes)
    const { count: prevCount } = await supabase
      .from('convocatorias')
      .select('id', { count: 'exact', head: true })
      .gte('fecha_cierre_postulacion', prevInicio)
      .lte('fecha_cierre_postulacion', prevFin)
      .not('fuente', 'in', `(${FUENTES_EXCLUIDAS.join(',')})`)
    if (typeof prevCount === 'number') {
      const diferencia = data.length - prevCount
      const porcentaje = prevCount > 0 ? Math.round((diferencia / prevCount) * 100) : 0
      comparativa_mes_anterior = { total: prevCount, diferencia, porcentaje }
    }
  }

  return {
    ok: true,
    mes:        mesParam,
    mes_label:  `${MESES_ES[mes - 1]} ${anio}`,
    total:      data.length,
    por_fuente,
    por_foco,
    por_monto,
    por_alcance,
    urgentes_esta_semana,
    comparativa_mes_anterior,
  }
})
