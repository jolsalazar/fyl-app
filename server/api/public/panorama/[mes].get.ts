// Endpoint público (sin auth) del PANORAMA mensual: la versión completa del
// reporte mensual que consume /blog/fondos-abiertos/[mes] en la web pública.
//
// Evolución de /calendario/agregado (que sigue existiendo por compatibilidad):
//   · Separa fondos y licitaciones (agregado excluía mercadopublico).
//   · SÍ incluye destacados con título/slug — mismo set de campos que ya expone
//     /api/public/convocatorias (resumen público, lo que rankea en Google).
//     Lo ACCIONABLE (link_postulacion, link_bases, requisitos, documentación)
//     NUNCA se expone acá: vive tras el registro en la app.
//   · Agrega "qué cierra el próximo mes" (conteos + destacados).
//
// CORS abierto sólo a https://fondosylicitaciones.cl. Cache 6h en edge.
//
// GET /api/public/panorama/2026-06
// → 200 {
//     ok, mes, mes_label, total,
//     fondos:       { total, por_fuente, por_foco, por_monto, por_alcance, urgentes_esta_semana },
//     licitaciones: { total, por_foco, por_monto, por_alcance, urgentes_esta_semana },
//     destacados_fondos:       [{ id, slug, fuente, tipo, titulo, … }],   (top 6 por monto)
//     destacados_licitaciones: [{ … }],                                   (top 6 por monto)
//     proximo_mes: { mes, mes_label, total_fondos, total_licitaciones, destacados: […] },
//     comparativa_mes_anterior: { total, diferencia, porcentaje } | null
//   }
// → 400 si `mes` tiene formato/valor inválido
// → 500 si falla la lectura de convocatorias

import { serverSupabaseServiceRole } from '#supabase/server'

const ALLOWED_ORIGIN    = 'https://fondosylicitaciones.cl'
const CACHE_TTL_SECONDS = 21600 // 6 horas
// A diferencia de /calendario/agregado, acá mercadopublico SÍ entra (es el mundo
// licitaciones). 'adjudicaciones' queda fuera: son resultados, no oportunidades.
const FUENTES_EXCLUIDAS = ['adjudicaciones']
const FOCO_TOP_N        = 8
const DESTACADOS_N      = 6
const PROXIMO_DESTACADOS_N = 4

const MESES_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const SELECT_PANORAMA =
  'id, titulo, descripcion_breve, fuente, tipo, foco, monto_rango, monto_maximo, alcance, region, fecha_cierre_postulacion'

function rangoMes (anio: number, mes: number): { inicio: string; fin: string } {
  const inicio = `${anio}-${String(mes).padStart(2, '0')}-01`
  // El día 0 del mes siguiente devuelve el último día del mes actual.
  const fin    = new Date(Date.UTC(anio, mes, 0)).toISOString().split('T')[0]
  return { inicio, fin }
}

// Igual que en convocatorias.get.ts / convocatorias/[id].get.ts (patrón del repo:
// cada endpoint público lleva su copia para no importar entre handlers).
function slugify (s: string | null | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '')
}

interface Agregados {
  total: number
  por_fuente:  Record<string, number>
  por_foco:    { nombre: string; count: number }[]
  por_monto:   Record<string, number>
  por_alcance: Record<string, number>
  urgentes_esta_semana: number
}

function agregarFilas (rows: any[], hoy: Date): Agregados {
  const por_fuente: Record<string, number>      = {}
  const por_foco_counts: Record<string, number> = {}
  const por_monto:  Record<string, number>      = {}
  const por_alcance: Record<string, number>     = {}
  const en7dias = new Date(hoy.getTime() + 7 * 86400000)

  let urgentes_esta_semana = 0

  for (const c of rows) {
    if (c.fuente) por_fuente[c.fuente] = (por_fuente[c.fuente] ?? 0) + 1
    if (Array.isArray(c.foco)) {
      for (const f of c.foco) {
        if (typeof f === 'string' && f.length > 0) {
          por_foco_counts[f] = (por_foco_counts[f] ?? 0) + 1
        }
      }
    }
    if (c.monto_rango) por_monto[c.monto_rango]  = (por_monto[c.monto_rango] ?? 0) + 1
    if (c.alcance)     por_alcance[c.alcance]    = (por_alcance[c.alcance] ?? 0) + 1
    if (c.fecha_cierre_postulacion) {
      const fc = new Date(c.fecha_cierre_postulacion + 'T00:00:00Z')
      if (fc >= hoy && fc <= en7dias) urgentes_esta_semana++
    }
  }

  const por_foco = Object.entries(por_foco_counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, FOCO_TOP_N)
    .map(([nombre, count]) => ({ nombre, count }))

  return { total: rows.length, por_fuente, por_foco, por_monto, por_alcance, urgentes_esta_semana }
}

// Resumen público de una convocatoria — mismo set de campos que
// /api/public/convocatorias. Nada accionable.
function aDestacado (c: any) {
  return {
    id:    c.id,
    slug:  `${slugify(c.titulo)}-${c.id}`,
    fuente: c.fuente,
    tipo:  c.tipo,
    titulo: c.titulo,
    descripcion_breve: c.descripcion_breve,
    monto_rango: c.monto_rango,
    monto_maximo: c.monto_maximo,
    alcance: c.alcance,
    region:  c.region,
    foco:    c.foco ?? [],
    fecha_cierre_postulacion: c.fecha_cierre_postulacion,
  }
}

// Top N por monto máximo (los sin monto van al final, desempate: cierre más próximo).
function topPorMonto (rows: any[], n: number): any[] {
  return [...rows]
    .filter(c => c.titulo)
    .sort((a, b) => {
      const ma = typeof a.monto_maximo === 'number' ? a.monto_maximo : -1
      const mb = typeof b.monto_maximo === 'number' ? b.monto_maximo : -1
      if (mb !== ma) return mb - ma
      return (a.fecha_cierre_postulacion ?? '9999') < (b.fecha_cierre_postulacion ?? '9999') ? -1 : 1
    })
    .slice(0, n)
    .map(aDestacado)
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

  const mesParam = getRouterParam(event, 'mes')

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

  // ── Mes pedido: una lectura paginada alimenta agregados + destacados ──
  // PostgREST corta en 1000 filas por request (db-max-rows); con licitaciones
  // incluidas un mes supera ese tope, así que paginamos con .range() hasta 5000.
  const PAGE = 1000
  const MAX_ROWS = 5000
  const data: any[] = []
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data: page, error } = await supabase
      .from('convocatorias')
      .select(SELECT_PANORAMA)
      .gte('fecha_cierre_postulacion', inicio)
      .lte('fecha_cierre_postulacion', fin)
      .not('fuente', 'in', `(${FUENTES_EXCLUIDAS.join(',')})`)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)

    if (error || !page) {
      setResponseStatus(event, 500)
      return { ok: false, error: 'fetch_failed' }
    }
    data.push(...page)
    if (page.length < PAGE) break
  }

  const hoy = new Date()
  hoy.setUTCHours(0, 0, 0, 0)
  const hoyStr = hoy.toISOString().split('T')[0]

  const filasFondos       = (data as any[]).filter(c => c.tipo === 'fondo')
  const filasLicitaciones = (data as any[]).filter(c => c.tipo === 'licitacion')

  // En el mes en curso no destacamos lo que ya cerró; en meses pasados se
  // muestra lo que hubo (reporte histórico).
  const esMesActual = hoyStr >= inicio && hoyStr <= fin
  const vigente = (c: any) => !esMesActual || (c.fecha_cierre_postulacion ?? '') >= hoyStr

  // ── Próximo mes: conteos exactos + destacados (consultas livianas) ──
  const nextMes  = mes === 12 ? 1        : mes + 1
  const nextAnio = mes === 12 ? anio + 1 : anio
  const { inicio: nextInicio, fin: nextFin } = rangoMes(nextAnio, nextMes)

  const countRange = (desde: string, hasta: string) => supabase
    .from('convocatorias')
    .select('id', { count: 'exact', head: true })
    .gte('fecha_cierre_postulacion', desde)
    .lte('fecha_cierre_postulacion', hasta)
    .not('fuente', 'in', `(${FUENTES_EXCLUIDAS.join(',')})`)

  const prevMes  = mes === 1 ? 12       : mes - 1
  const prevAnio = mes === 1 ? anio - 1 : anio
  const { inicio: prevInicio, fin: prevFin } = rangoMes(prevAnio, prevMes)

  const [
    { count: mesFondosCount },
    { count: mesLicCount },
    { count: nextFondosCount },
    { count: nextLicCount },
    { data: nextDestacadosData },
    prevRes,
  ] = await Promise.all([
    countRange(inicio, fin).eq('tipo', 'fondo'),
    countRange(inicio, fin).eq('tipo', 'licitacion'),
    countRange(nextInicio, nextFin).eq('tipo', 'fondo'),
    countRange(nextInicio, nextFin).eq('tipo', 'licitacion'),
    supabase
      .from('convocatorias')
      .select(SELECT_PANORAMA)
      .eq('tipo', 'fondo')
      .gte('fecha_cierre_postulacion', nextInicio)
      .lte('fecha_cierre_postulacion', nextFin)
      .not('fuente', 'in', `(${FUENTES_EXCLUIDAS.join(',')})`)
      .order('monto_maximo', { ascending: false, nullsFirst: false })
      .limit(PROXIMO_DESTACADOS_N * 3),
    prevAnio >= 2024
      ? countRange(prevInicio, prevFin)
      : Promise.resolve({ count: null } as { count: number | null }),
  ])

  // Totales exactos (head count): los agregados se calculan sobre hasta 5000
  // filas, pero los conteos visibles no dependen de ese tope.
  const totalFondos       = mesFondosCount ?? filasFondos.length
  const totalLicitaciones = mesLicCount ?? filasLicitaciones.length
  const totalMes          = totalFondos + totalLicitaciones

  let comparativa_mes_anterior: { total: number; diferencia: number; porcentaje: number } | null = null
  if (typeof prevRes.count === 'number') {
    const diferencia = totalMes - prevRes.count
    const porcentaje = prevRes.count > 0 ? Math.round((diferencia / prevRes.count) * 100) : 0
    comparativa_mes_anterior = { total: prevRes.count, diferencia, porcentaje }
  }

  const fondosAgg       = agregarFilas(filasFondos, hoy)
  const licitacionesAgg = agregarFilas(filasLicitaciones, hoy)
  fondosAgg.total       = totalFondos
  licitacionesAgg.total = totalLicitaciones

  return {
    ok: true,
    mes:       mesParam,
    mes_label: `${MESES_ES[mes - 1]} ${anio}`,
    total:     totalMes,
    fondos:       fondosAgg,
    licitaciones: licitacionesAgg,
    destacados_fondos:       topPorMonto(filasFondos.filter(vigente), DESTACADOS_N),
    destacados_licitaciones: topPorMonto(filasLicitaciones.filter(vigente), DESTACADOS_N),
    proximo_mes: {
      mes:       `${nextAnio}-${String(nextMes).padStart(2, '0')}`,
      mes_label: `${MESES_ES[nextMes - 1]} ${nextAnio}`,
      total_fondos:       nextFondosCount ?? 0,
      total_licitaciones: nextLicCount ?? 0,
      destacados: topPorMonto(nextDestacadosData ?? [], PROXIMO_DESTACADOS_N),
    },
    comparativa_mes_anterior,
  }
})
