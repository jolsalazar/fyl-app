export interface Razon { tipo: 'positivo' | 'neutro' | 'negativo'; texto: string }
export interface MatchResult { score: number; nivel: 'alto' | 'medio' | 'bajo'; razones: Razon[] }

export interface Perfil {
  tipo_persona:    string | null
  estado_proyecto: string | null
  foco:            string[]
  alcance:         string[]
  monto_minimo:    string | null
}

const MONTO_ORDER = ['hasta_1M', '1M_10M', '10M_30M', '30M_60M', '60M_100M', 'sobre_100M']

function matchTipoPersona(userTipo: string | null, convTipos: string[] | null): Razon | null {
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

function matchFoco(userFoco: string[], convFoco: string[] | null): Razon | null {
  if (!userFoco?.length || !convFoco?.length) return null
  const overlap = userFoco.filter(f => convFoco.includes(f))
  if (overlap.length) return { tipo: 'positivo', texto: `Tu foco coincide: ${overlap.slice(0, 3).join(', ')}` }
  return { tipo: 'negativo', texto: `Focos del fondo (${convFoco.slice(0, 2).join(', ')}) no coinciden con tu proyecto` }
}

function matchEstado(userEstado: string | null, convNivel: string | null): Razon | null {
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

function matchMonto(userMinimo: string | null, convRango: string | null): Razon | null {
  if (!convRango) return null
  const LABELS: Record<string, string> = { hasta_1M: 'Hasta $1M', '1M_10M': '$1M–$10M', '10M_30M': '$10M–$30M', '30M_60M': '$30M–$60M', '60M_100M': '$60M–$100M', sobre_100M: '+$100M' }
  if (!userMinimo) return { tipo: 'neutro', texto: `Monto del fondo: ${LABELS[convRango] ?? convRango}` }
  const uIdx = MONTO_ORDER.indexOf(userMinimo)
  const cIdx = MONTO_ORDER.indexOf(convRango)
  if (cIdx >= uIdx) return { tipo: 'positivo', texto: `Monto (${LABELS[convRango]}) dentro de tu rango` }
  return { tipo: 'neutro', texto: `Monto (${LABELS[convRango]}) bajo tu mínimo de interés` }
}

function matchAlcance(userAlcance: string[], convAlcance: string | null): Razon | null {
  if (!userAlcance?.length || !convAlcance) return null
  const LABELS: Record<string, string> = { regional: 'Regional', nacional: 'Nacional', internacional: 'Internacional' }
  if (userAlcance.includes(convAlcance)) return { tipo: 'positivo', texto: `Alcance ${LABELS[convAlcance]} es de tu interés` }
  return { tipo: 'neutro', texto: `Alcance del fondo: ${LABELS[convAlcance]}` }
}

export function calcularMatch(perfil: Perfil, conv: any): MatchResult {
  const razones: Razon[] = []
  let posibles = 0; let obtenidos = 0

  const checks: [Razon | null, number][] = [
    [matchTipoPersona(perfil.tipo_persona, conv.perfil_tipo_persona), 30],
    [matchFoco(perfil.foco, conv.foco),                               25],
    [matchEstado(perfil.estado_proyecto, conv.perfil_nivel_desarrollo), 20],
    [matchMonto(perfil.monto_minimo, conv.monto_rango),               15],
    [matchAlcance(perfil.alcance, conv.alcance),                      10],
  ]

  for (const [razon, peso] of checks) {
    if (!razon) continue
    razones.push(razon)
    if (razon.tipo !== 'neutro' && peso > 0) {
      posibles += peso
      if (razon.tipo === 'positivo') obtenidos += peso
    }
  }

  if (conv.perfil_nivel_ventas)
    razones.push({ tipo: 'neutro', texto: `Nivel de ventas requerido: "${conv.perfil_nivel_ventas}"` })

  const score = posibles > 0 ? Math.round((obtenidos / posibles) * 100) : 50
  const nivel: 'alto' | 'medio' | 'bajo' = score >= 70 ? 'alto' : score >= 40 ? 'medio' : 'bajo'

  razones.sort((a, b) => ({ positivo: 0, neutro: 1, negativo: 2 }[a.tipo] - { positivo: 0, neutro: 1, negativo: 2 }[b.tipo]))

  return { score, nivel, razones }
}

export async function cargarPerfil(supabase: any, userId: string): Promise<Perfil> {
  const MONTO_ORDER_LOCAL = ['hasta_1M', '1M_10M', '10M_30M', '30M_60M', '60M_100M', 'sobre_100M']

  const [{ data: perfilData }, { data: alertasData }] = await Promise.all([
    supabase.from('perfil_postulante')
      .select('tipo_persona, estado_proyecto')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase.from('alert_configs')
      .select('foco, alcance_interes, monto_minimo, activo')
      .eq('user_id', userId),
  ])

  const focos = new Set<string>()
  const alcances = new Set<string>()
  let montoMin: string | null = null

  for (const a of (alertasData ?? []).filter((a: any) => a.activo)) {
    for (const f of (a.foco ?? [])) focos.add(f)
    for (const al of (a.alcance_interes ?? [])) alcances.add(al)
    if (a.monto_minimo) {
      if (!montoMin || MONTO_ORDER_LOCAL.indexOf(a.monto_minimo) < MONTO_ORDER_LOCAL.indexOf(montoMin))
        montoMin = a.monto_minimo
    }
  }

  return {
    tipo_persona:    perfilData?.tipo_persona ?? null,
    estado_proyecto: perfilData?.estado_proyecto ?? null,
    foco:            [...focos],
    alcance:         [...alcances],
    monto_minimo:    montoMin,
  }
}
