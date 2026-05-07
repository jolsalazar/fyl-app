// Las fechas tipo 'YYYY-MM-DD' sin hora se interpretan como UTC medianoche.
// En Chile (UTC-3/4) eso retrocede un día. Anclar al mediodía evita el problema.
function parseDate(f: string): Date {
  return new Date(f.length === 10 ? f + 'T12:00:00' : f)
}

export function formatFecha(f?: string | null): string {
  if (!f) return '—'
  return parseDate(f).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatFechaCorta(f?: string | null): string {
  if (!f) return '—'
  return parseDate(f).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatFechaHora(f?: string | null): string {
  if (!f) return '—'
  return new Date(f).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
