// Helpers Supabase REST con PRESUPUESTO de subrequests, compartidos por los
// workers de digest (alert-digest, weekly-digest, monthly-report).
//
// Workers Free permite 50 subrequests por invocación; el fetch nº 51 LANZA
// "Too many subrequests" y mata la corrida completa (así estuvieron caídos
// los digests: cada tick moría a exactamente 50 subrequests sin enviar nada).
//
// Acá TODO fetch pasa por el presupuesto: cuando se agota, se lanza
// BudgetExceeded ANTES de tocar la red — y, más importante, los workers
// preguntan canAfford() por adelantado para CORTAR CON GRACIA: envían lo ya
// armado y dejan el resto para el próximo tick de la ventana (sent-log).

export class BudgetExceeded extends Error {
  constructor() {
    super('Presupuesto de subrequests agotado')
    this.name = 'BudgetExceeded'
  }
}

// Error HTTP en una lectura que DEBE ser completa (getAll). Se lanza en vez de
// devolver una lista parcial/vacía: una lista incompleta silenciosa es venenosa
// aguas abajo (un sent-log "vacío" re-envía correos; un alert_configs "vacío"
// registraría a toda la cohorte como procesada sin procesarla). El tick aborta
// y lo reintenta el siguiente — los inserts son idempotentes, no hay dobles.
export class SbHttpError extends Error {
  constructor(public status: number, path: string) {
    super(`Supabase HTTP ${status} en ${path}`)
    this.name = 'SbHttpError'
  }
}

export interface SbEnv {
  SUPABASE_URL:         string
  SUPABASE_SERVICE_KEY: string
}

// Margen bajo el tope real de 50: el runtime también cuenta reintentos/redirects.
const DEFAULT_CAP = 45

export class Sb {
  used = 0
  constructor(private env: SbEnv, public cap = DEFAULT_CAP) {}

  get remaining(): number { return this.cap - this.used }
  canAfford(n: number): boolean { return this.remaining >= n }

  // Único punto de salida a la red: descuenta del presupuesto. Úsalo también
  // para requests no-Supabase (Resend, endpoints propios) para que cuenten.
  async fetch(input: string, init?: RequestInit): Promise<Response> {
    if (!this.canAfford(1)) throw new BudgetExceeded()
    this.used++
    return fetch(input, init)
  }

  // Público para requests Supabase ad-hoc (siempre vía this.fetch, que presupuesta).
  headers() {
    return {
      'apikey':        this.env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${this.env.SUPABASE_SERVICE_KEY}`,
      'Content-Type':  'application/json',
    }
  }

  async get<T>(path: string): Promise<T | null> {
    const res = await this.fetch(`${this.env.SUPABASE_URL}${path}`, { headers: this.headers() })
    if (!res.ok) return null
    return res.json()
  }

  // Lectura paginada con header Range: PostgREST corta en 1000 filas por request,
  // así que iteramos páginas hasta agotar para no truncar la lista completa.
  // Una página con error HTTP LANZA SbHttpError (ver arriba) — jamás se devuelve
  // una lista parcial como si fuera completa. Los callers deben incluir order=
  // en el path para que los cortes de página sean estables.
  async getAll<T>(path: string, pageSize = 1000): Promise<T[]> {
    const all: T[] = []
    for (let from = 0; from < 100_000; from += pageSize) {
      const to  = from + pageSize - 1
      const res = await this.fetch(`${this.env.SUPABASE_URL}${path}`, {
        headers: { ...this.headers(), 'Range-Unit': 'items', 'Range': `${from}-${to}` },
      })
      if (!res.ok && res.status !== 206) throw new SbHttpError(res.status, path)
      const page = (await res.json()) as T[]
      all.push(...page)
      if (page.length < pageSize) break
    }
    return all
  }

  // Conteo EXACTO sin traer filas: Prefer count=exact + Range 0-0 → el total viene
  // en el header Content-Range ("0-0/<total>"). Evita el límite de 1000 de PostgREST.
  async count(path: string): Promise<number> {
    const res = await this.fetch(`${this.env.SUPABASE_URL}${path}&select=id`, {
      headers: { ...this.headers(), 'Prefer': 'count=exact', 'Range': '0-0' },
    })
    if (!res.ok && res.status !== 206) return 0
    const m = (res.headers.get('Content-Range') ?? '').match(/\/(\d+)$/)
    return m ? parseInt(m[1], 10) : 0
  }

  // Insert idempotente (ignore-duplicates): registrar la misma fila dos veces es
  // un no-op si la tabla tiene índice único (p. ej. digest_sent_log).
  async insert(path: string, body: object[]): Promise<boolean> {
    if (!body.length) return true
    const res = await this.fetch(`${this.env.SUPABASE_URL}${path}`, {
      method:  'POST',
      headers: { ...this.headers(), 'Prefer': 'resolution=ignore-duplicates,return=minimal' },
      body:    JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error(`sb.insert ${path} failed: ${res.status} ${text}`)
    }
    return res.ok
  }

  async patch(path: string, body: object): Promise<boolean> {
    const res = await this.fetch(`${this.env.SUPABASE_URL}${path}`, {
      method:  'PATCH',
      headers: { ...this.headers(), 'Prefer': 'return=minimal' },
      body:    JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error(`sb.patch ${path} failed: ${res.status} ${text}`)
    }
    return res.ok
  }

  async rpc<T>(fn: string, args: object): Promise<T | null> {
    const res = await this.fetch(`${this.env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method:  'POST',
      headers: this.headers(),
      body:    JSON.stringify(args),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error(`sb.rpc ${fn} failed: ${res.status} ${text}`)
      return null
    }
    return res.json()
  }

  // Emails de un lote de usuarios en UN subrequest (rpc/get_user_emails).
  // Reemplaza el paginado de la admin API de GoTrue, que podía costar N páginas.
  // Devuelve null si la RPC FALLÓ (p. ej. migración no aplicada): el caller debe
  // ABORTAR el tick, no tratar al lote como "sin email" — eso lo registraría
  // como terminal sin haberle enviado nada.
  // Los emails malformados se omiten (→ "sin email", terminal): un solo address
  // inválido en un batch de Resend rechaza el chunk COMPLETO de 100.
  async emailsFor(userIds: string[]): Promise<Map<string, string> | null> {
    const map = new Map<string, string>()
    if (!userIds.length) return map
    const rows = await this.rpc<{ id: string; email: string | null }[]>(
      'get_user_emails', { user_ids: userIds }
    )
    if (rows === null) return null
    for (const r of rows) {
      if (r.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) map.set(r.id, r.email)
    }
    return map
  }
}

// ── Envío en lote a Resend ──────────────────────────────────────────
// /emails/batch acepta hasta 100 correos por request → ⌈N/100⌉ subrequests en
// vez de uno por usuario. Compartido por los workers de digest.
//
// Idempotencia: `registrar` (si viene) anota los user_id en el sent-log
// INMEDIATAMENTE tras cada chunk OK — si algo lanza después, lo ya enviado no
// se repite. Si el registro FALLA tras un envío OK se reintenta una vez y, si
// sigue fallando, se CORTA el envío: seguir mandando chunks cuyo registro
// también fallaría multiplica los dobles del próximo tick.
//
// Presupuesto: antes de cada chunk se reservan 2 subrequests (envío + registro);
// si no alcanzan, el resto de mensajes queda para el próximo tick.

export interface EmailMsg {
  userId:  string
  to:      string
  subject: string
  html:    string
}

export async function sendResendBatch(
  sb: Sb,
  apiKey: string,
  from: string,
  mensajes: EmailMsg[],
  log: string[],
  registrar: ((ids: string[]) => Promise<boolean>) | null,
): Promise<string[]> {
  const enviadosIds: string[] = []
  const CHUNK = 100
  for (let i = 0; i < mensajes.length; i += CHUNK) {
    const n = Math.floor(i / CHUNK) + 1
    if (!sb.canAfford(2)) {
      log.push(`  ✂️ Presupuesto (${sb.used}/${sb.cap}): quedan ${mensajes.length - i} mensajes para el próximo tick`)
      break
    }
    const lote = mensajes.slice(i, i + CHUNK)
    try {
      const res = await sb.fetch('https://api.resend.com/emails/batch', {
        method:  'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(lote.map(m => ({
          from,
          to:      [m.to],
          subject: m.subject,
          html:    m.html,
        }))),
      })
      if (!res.ok) {
        // Chunk no enviado: sus user_id NO se registran → reintento próximo tick.
        const text = await res.text().catch(() => '')
        log.push(`  ⚠️ Lote Resend #${n} falló: ${res.status} ${text}`)
        console.error(`[resend] batch #${n} falló: ${res.status} ${text}`)
        continue
      }
      const ids = lote.map(m => m.userId)
      enviadosIds.push(...ids)
      if (registrar) {
        let ok = await registrar(ids)
        if (!ok) ok = await registrar(ids)   // reintento único
        if (!ok) {
          log.push(`  ⚠️ Chunk #${n} ENVIADO pero su registro falló dos veces — corto el envío (esos ${ids.length} podrían duplicarse el próximo tick)`)
          console.error(`[resend] registro del chunk #${n} falló tras reintento`)
          break
        }
      }
    } catch (e) {
      log.push(`  ⚠️ Lote Resend #${n} lanzó: ${e instanceof Error ? e.message : e}`)
      console.error(`[resend] batch #${n} lanzó:`, e)
      if (e instanceof BudgetExceeded) break   // los chunks restantes también fallarían
    }
  }
  return enviadosIds
}
