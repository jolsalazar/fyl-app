// Single source of truth para el cálculo de match proyecto ↔ convocatoria.
// Importado por: pages/dashboard/match.vue, pages/dashboard/oportunidades/[id].vue,
// pages/onboarding.vue y workers/alert-digest/src/index.ts.

export interface Razon {
  tipo:        'positivo' | 'neutro' | 'negativo'
  texto:       string
  // Fracción del peso (0..1) que aplica cuando tipo='positivo'. Default 1 (todo o nada).
  // Permite crédito parcial — ej. coincide solo 1 de 3 focos.
  peso_ratio?: number
}

export interface MatchResult {
  score:   number
  nivel:   'alto' | 'medio' | 'bajo'
  razones: Razon[]
}

export interface Perfil {
  tipo_persona:    string | null
  estado_proyecto: string | null
  foco:            string[]
  alcance:         string[]
  monto_minimo:    string | null
}

export const MONTO_ORDER = ['hasta_1M', '1M_10M', '10M_30M', '30M_60M', '60M_100M', 'sobre_100M']

const MONTO_LABELS: Record<string, string> = {
  hasta_1M: 'Hasta $1M', '1M_10M': '$1M–$10M', '10M_30M': '$10M–$30M',
  '30M_60M': '$30M–$60M', '60M_100M': '$60M–$100M', sobre_100M: '+$100M',
}

const ALCANCE_LABELS: Record<string, string> = {
  regional: 'Regional', nacional: 'Nacional', internacional: 'Internacional',
}

function matchTipoPersona(userTipo: string | null, convTipos: string[] | null | undefined): Razon | null {
  if (!userTipo || !convTipos?.length) return null
  const kw = userTipo === 'natural' ? ['natural'] : ['jurídic', 'juridic', 'empresa', 'sociedad']
  const label = userTipo === 'natural' ? 'Persona Natural' : 'Persona Jurídica'
  const match = convTipos.some(t => {
    const tl = t.toLowerCase()
    return kw.some(k => tl.includes(k)) || tl.includes('ambos') || tl.includes('todos') || tl.includes('cualquier')
  })
  if (match) return { tipo: 'positivo', texto: `Acepta ${label}` }
  return { tipo: 'negativo', texto: `Dirigido a ${convTipos.slice(0, 2).join(' / ')}, no a ${label}` }
}

function matchFoco(userFoco: string[], convFoco: string[] | null | undefined): Razon | null {
  if (!userFoco?.length || !convFoco?.length) return null
  const overlap = userFoco.filter(f => convFoco.includes(f))
  if (!overlap.length) {
    return { tipo: 'negativo', texto: `Focos del fondo (${convFoco.slice(0, 2).join(', ')}) no coinciden con tu proyecto` }
  }
  // Crédito parcial: cubierto sobre el set más chico. Si un lado es subconjunto del otro = 100%.
  const denom = Math.min(userFoco.length, convFoco.length)
  const ratio = overlap.length / denom
  const completo = overlap.length >= denom
  const lista = overlap.slice(0, 3).join(', ')
  return {
    tipo: 'positivo',
    texto: completo
      ? `Tu foco coincide: ${lista}`
      : `Coincide ${overlap.length} de ${denom} focos: ${lista}`,
    peso_ratio: ratio,
  }
}

function matchEstado(userEstado: string | null, convNivel: string | null | undefined): Razon | null {
  if (!userEstado || !convNivel) return null
  const nl = convNivel.toLowerCase()
  const map: Record<string, { kw: string[]; label: string }> = {
    solo_idea:     { kw: ['idea', 'ideación', 'concepto', 'sin actividad', 'sin ventas'], label: 'Solo idea' },
    maqueta:       { kw: ['maqueta', 'diseño', 'modelo', 'boceto'],                       label: 'Maqueta' },
    prototipo:     { kw: ['prototipo', 'mvp', 'funcional', 'piloto', 'validación'],       label: 'Prototipo' },
    marcha_blanca: { kw: ['marcha blanca', 'primeras ventas', 'tracción', 'temprana'],    label: 'Marcha blanca' },
    crecimiento:   { kw: ['escala', 'crecimiento', 'expansión', 'consolidado', 'empresa en marcha', 'con ventas'], label: 'En crecimiento' },
  }
  const stage = map[userEstado]
  if (!stage) return null
  const match = stage.kw.some(k => nl.includes(k))
  if (match) return { tipo: 'positivo', texto: `Tu etapa (${stage.label}) califica para este fondo` }
  return { tipo: 'neutro', texto: `Nivel requerido: "${convNivel}"` }
}

function matchMonto(userMinimo: string | null, convRango: string | null | undefined): Razon | null {
  if (!convRango) return null
  if (!userMinimo) return { tipo: 'neutro', texto: `Monto del fondo: ${MONTO_LABELS[convRango] ?? convRango}` }
  const uIdx = MONTO_ORDER.indexOf(userMinimo)
  const cIdx = MONTO_ORDER.indexOf(convRango)
  if (cIdx >= uIdx) return { tipo: 'positivo', texto: `Monto (${MONTO_LABELS[convRango]}) dentro de tu rango` }
  return { tipo: 'neutro', texto: `Monto (${MONTO_LABELS[convRango]}) bajo tu mínimo de interés` }
}

function matchAlcance(userAlcance: string[], convAlcance: string | null | undefined): Razon | null {
  if (!userAlcance?.length || !convAlcance) return null
  if (userAlcance.includes(convAlcance)) return { tipo: 'positivo', texto: `Alcance ${ALCANCE_LABELS[convAlcance]} es de tu interés` }
  return { tipo: 'neutro', texto: `Alcance del fondo: ${ALCANCE_LABELS[convAlcance]}` }
}

// Peso 0 intencional: convocatorias.perfil_antiguedad_empresa es texto libre, no parseable
// de forma confiable. Lo mostramos como razón neutra para que el usuario decida. Promover a
// peso > 0 cuando el scraper extraiga `antiguedad_minima_anos` estructurada.
function matchAntiguedad(userTipo: string | null, convAntig: string | null | undefined): Razon | null {
  if (userTipo !== 'juridica' || !convAntig) return null
  return { tipo: 'neutro', texto: `Antigüedad requerida: "${convAntig}"` }
}

export function calcularMatch(perfil: Perfil, conv: any): MatchResult {
  const razones: Razon[] = []
  let posibles = 0; let obtenidos = 0

  const checks: [Razon | null, number][] = [
    [matchTipoPersona(perfil.tipo_persona, conv.perfil_tipo_persona),     30],
    [matchFoco(perfil.foco, conv.foco),                                   25],
    [matchEstado(perfil.estado_proyecto, conv.perfil_nivel_desarrollo),   20],
    [matchMonto(perfil.monto_minimo, conv.monto_rango),                   15],
    [matchAlcance(perfil.alcance, conv.alcance),                          10],
    [matchAntiguedad(perfil.tipo_persona, conv.perfil_antiguedad_empresa), 0],
  ]

  for (const [razon, peso] of checks) {
    if (!razon) continue
    razones.push(razon)
    if (razon.tipo !== 'neutro' && peso > 0) {
      posibles += peso
      if (razon.tipo === 'positivo') obtenidos += peso * (razon.peso_ratio ?? 1)
    }
  }

  if (conv.perfil_nivel_ventas)
    razones.push({ tipo: 'neutro', texto: `Nivel de ventas requerido: "${conv.perfil_nivel_ventas}"` })

  const score = posibles > 0 ? Math.round((obtenidos / posibles) * 100) : 50
  const nivel: 'alto' | 'medio' | 'bajo' = score >= 70 ? 'alto' : score >= 40 ? 'medio' : 'bajo'

  razones.sort((a, b) => {
    const ord = { positivo: 0, neutro: 1, negativo: 2 }
    return ord[a.tipo] - ord[b.tipo]
  })

  return { score, nivel, razones }
}

export async function cargarPerfil(supabase: any, userId: string, proyectoId?: string): Promise<Perfil> {
  let query = supabase
    .from('proyectos')
    .select('tipo_persona, estado_proyecto, foco, alcance, monto_minimo')
    .eq('user_id', userId)

  if (proyectoId) {
    query = query.eq('id', proyectoId)
  } else {
    query = query.order('created_at', { ascending: true }).limit(1)
  }

  const { data } = await query.maybeSingle()

  return {
    tipo_persona:    data?.tipo_persona    ?? null,
    estado_proyecto: data?.estado_proyecto ?? null,
    foco:            data?.foco            ?? [],
    alcance:         data?.alcance         ?? [],
    monto_minimo:    data?.monto_minimo    ?? null,
  }
}

export function perfilCompleto(perfil: Perfil): boolean {
  return !!perfil.tipo_persona && !!perfil.estado_proyecto
}
