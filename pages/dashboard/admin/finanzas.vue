<template>
  <NuxtLayout name="dashboard">
    <div class="content">
      <div class="header">
        <div>
          <h1>Finanzas</h1>
          <p class="subtitle">MRR, cobros y comisiones de MercadoPago</p>
        </div>
        <div class="header-actions">
          <input v-model="mesRef" type="month" class="month-input" />
          <button class="btn-backfill" :disabled="backfilling" @click="ejecutarBackfill">
            {{ backfilling ? 'Sincronizando…' : 'Sincronizar pagos MP' }}
          </button>
        </div>
      </div>

      <div v-if="loading" class="loading">Cargando…</div>
      <template v-else>

        <!-- KPIs -->
        <div class="stats-row">
          <div class="stat-card accent-green">
            <span class="stat-num">{{ fmtClp(kpis.mrr_neto) }}</span>
            <span class="stat-label">MRR neto</span>
            <span class="stat-sub">Bruto: {{ fmtClp(kpis.mrr_bruto) }}</span>
            <span v-if="kpis.mrr_comprometido > kpis.mrr_bruto" class="stat-sub">
              Comprometido post-promo: <strong>{{ fmtClp(kpis.mrr_comprometido) }}</strong>
            </span>
          </div>
          <div class="stat-card accent-blue">
            <span class="stat-num">{{ fmtClp(kpis.arr_neto) }}</span>
            <span class="stat-label">ARR neto</span>
            <span class="stat-sub">MRR neto × 12</span>
          </div>
          <div class="stat-card">
            <span class="stat-num">{{ kpis.clientes_pagos }}</span>
            <span class="stat-label">Clientes pagando</span>
            <span class="stat-sub">{{ kpis.clientes_total }} usuarios totales</span>
          </div>
          <div class="stat-card">
            <span class="stat-num">{{ fmtClp(kpis.por_liberar) }}</span>
            <span class="stat-label">Por liberar</span>
            <span class="stat-sub">Pagos pendientes de payout</span>
          </div>
        </div>

        <!-- Movimiento MRR del mes -->
        <div class="section">
          <h2>Movimiento MRR <span class="h2-sub">{{ mesLabel }}</span></h2>

          <div class="mrr-grid">
            <div class="mrr-cell positive">
              <span class="mrr-label">Nuevo MRR</span>
              <span class="mrr-num">+{{ fmtClp(resumenMov.nuevoMrr) }}</span>
              <span class="mrr-sub">{{ resumenMov.nuevos }} nuevos clientes</span>
            </div>
            <div class="mrr-cell positive">
              <span class="mrr-label">Expansión</span>
              <span class="mrr-num">+{{ fmtClp(resumenMov.expansionMrr) }}</span>
              <span class="mrr-sub">{{ resumenMov.expansiones }} upgrades</span>
            </div>
            <div class="mrr-cell negative">
              <span class="mrr-label">Contracción</span>
              <span class="mrr-num">-{{ fmtClp(Math.abs(resumenMov.contraccionMrr)) }}</span>
              <span class="mrr-sub">{{ resumenMov.contracciones }} downgrades</span>
            </div>
            <div class="mrr-cell negative">
              <span class="mrr-label">Churn</span>
              <span class="mrr-num">-{{ fmtClp(Math.abs(resumenMov.churnMrr)) }}</span>
              <span class="mrr-sub">{{ resumenMov.churns }} cancelaciones · {{ resumenMov.churnRate }}%</span>
            </div>
            <div class="mrr-cell net" :class="resumenMov.netNew >= 0 ? 'positive' : 'negative'">
              <span class="mrr-label">Net new MRR</span>
              <span class="mrr-num">{{ resumenMov.netNew >= 0 ? '+' : '-' }}{{ fmtClp(Math.abs(resumenMov.netNew)) }}</span>
              <span class="mrr-sub">Movimiento neto del mes</span>
            </div>
          </div>

          <div v-if="movimientos.length" style="margin-top:1.25rem">
            <p class="tabla-title">Detalle del mes</p>
            <table class="tabla">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>De</th>
                  <th>A</th>
                  <th class="col-num">Δ MRR</th>
                  <th>Tipo</th>
                  <th>Origen</th>
                  <th class="col-num">Fecha</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="m in movimientos" :key="m.user_id + m.occurred_at">
                  <td class="text-mono">{{ m.user_email || m.user_id }}</td>
                  <td>{{ m.from_plan }}</td>
                  <td>{{ m.to_plan }}</td>
                  <td class="col-num" :class="m.mrr_delta >= 0 ? 'text-pos' : 'text-neg'">
                    {{ m.mrr_delta >= 0 ? '+' : '' }}{{ fmtClp(m.mrr_delta) }}
                  </td>
                  <td><span class="badge" :class="'badge-' + m.movement_type">{{ labelMov(m.movement_type) }}</span></td>
                  <td class="text-muted">{{ m.source }}</td>
                  <td class="col-num text-muted">{{ fmtFecha(m.occurred_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="empty">Sin movimientos en este mes.</div>
        </div>

        <!-- Cobros del mes -->
        <div class="section">
          <h2>Cobros reales <span class="h2-sub">{{ mesLabel }} vs mes anterior</span></h2>

          <div class="cobros-grid">
            <div class="cobros-card">
              <span class="cobros-titulo">Este mes</span>
              <div class="cobros-num">{{ fmtClp(cobros.mes_neto) }}</div>
              <div class="cobros-detalle">
                <div><span>Bruto cobrado</span><strong>{{ fmtClp(cobros.mes_bruto) }}</strong></div>
                <div><span>Comisión MP</span><strong class="text-neg">-{{ fmtClp(cobros.mes_fee) }}</strong></div>
                <div><span>IVA s/comisión</span><strong class="text-neg">-{{ fmtClp(cobros.mes_taxes) }}</strong></div>
                <div class="row-total"><span>Neto recibido</span><strong class="text-pos">{{ fmtClp(cobros.mes_neto) }}</strong></div>
                <div><span># transacciones</span><strong>{{ cobros.mes_count }}</strong></div>
              </div>
            </div>
            <div class="cobros-card cobros-prev">
              <span class="cobros-titulo">Mes anterior</span>
              <div class="cobros-num">{{ fmtClp(cobros.mes_anterior_neto) }}</div>
              <div class="cobros-detalle">
                <div><span>Bruto cobrado</span><strong>{{ fmtClp(cobros.mes_anterior_bruto) }}</strong></div>
                <div><span>Neto recibido</span><strong>{{ fmtClp(cobros.mes_anterior_neto) }}</strong></div>
                <div><span># transacciones</span><strong>{{ cobros.mes_anterior_count }}</strong></div>
                <div class="row-total"><span>MoM neto</span>
                  <strong :class="momPct >= 0 ? 'text-pos' : 'text-neg'">
                    {{ momPct >= 0 ? '+' : '' }}{{ momPct.toFixed(1) }}%
                  </strong>
                </div>
              </div>
            </div>
          </div>

          <p class="nota">
            Tarifa MP Chile aplicada hoy: <strong>3,2% + IVA 19%</strong> (= 3,808% efectivo).
            Cuando hay pagos reales en BD, se usan los valores exactos que devuelve MP (no estimaciones).
          </p>
        </div>

        <!-- Desglose MRR por plan -->
        <div class="section">
          <h2>Desglose MRR por plan <span class="h2-sub">basado en subscriptions reales</span></h2>
          <table class="tabla">
            <thead>
              <tr>
                <th>Plan</th>
                <th class="col-num">Clientes</th>
                <th class="col-num">Precio regular</th>
                <th class="col-num">MRR actual</th>
                <th class="col-num">Comprometido</th>
                <th class="col-num">Fee estimado</th>
                <th class="col-num">MRR neto</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="d in desglose" :key="d.plan">
                <td><span class="plan-tag" :class="'plan-' + d.plan">{{ d.plan }}</span></td>
                <td class="col-num">{{ d.clientes }}</td>
                <td class="col-num text-muted">{{ fmtClp(d.precio_regular) }}</td>
                <td class="col-num">{{ fmtClp(d.mrr_actual) }}</td>
                <td class="col-num text-muted">{{ fmtClp(d.mrr_comprometido) }}</td>
                <td class="col-num text-neg">-{{ fmtClp(d.fee_estimado) }}</td>
                <td class="col-num text-pos"><strong>{{ fmtClp(d.mrr_neto_actual) }}</strong></td>
              </tr>
              <tr v-if="!desglose.length">
                <td colspan="7" class="empty">Sin clientes pagando todavía.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Por liberar -->
        <div class="section">
          <h2>Próximas liberaciones MP</h2>
          <div v-if="!porLiberar.length" class="empty">
            Nada por liberar — tu cuenta MP libera los pagos al instante.
          </div>
          <table v-else class="tabla">
            <thead>
              <tr>
                <th>Payment ID</th>
                <th>Email</th>
                <th class="col-num">Bruto</th>
                <th class="col-num">Neto</th>
                <th class="col-num">Cobrado</th>
                <th class="col-num">Libera</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in porLiberar" :key="p.mp_payment_id">
                <td class="text-mono">{{ p.mp_payment_id }}</td>
                <td class="text-mono">{{ p.user_email || '—' }}</td>
                <td class="col-num">{{ fmtClp(p.transaction_amount) }}</td>
                <td class="col-num text-pos">{{ fmtClp(p.net_received_amount) }}</td>
                <td class="col-num text-muted">{{ fmtFecha(p.date_approved) }}</td>
                <td class="col-num">{{ fmtFecha(p.money_release_date) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Warning si fallaron algunas fetches -->
        <div v-if="warnings.length" class="warning-box">
          <strong>Avisos:</strong>
          <ul>
            <li v-for="w in warnings" :key="w">{{ w }}</li>
          </ul>
        </div>

      </template>
    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'admin'], layout: false })

const supabase = useSupabaseClient()

interface Kpis {
  mrr_bruto:        number
  mrr_neto:         number
  mrr_comprometido: number   // SUM(regular_amount) — MRR cuando todas las promos terminen
  arr_neto:         number
  por_liberar:      number
  clientes_pagos:   number
  clientes_total:   number
}
interface Movimiento {
  user_id:       string
  user_email:    string | null
  from_plan:     string
  to_plan:       string
  mrr_delta:     number
  occurred_at:   string
  source:        string
  movement_type: 'new' | 'expansion' | 'contraction' | 'churn' | 'noop'
}
interface Cobros {
  mes_bruto:          number
  mes_fee:            number
  mes_taxes:          number
  mes_neto:           number
  mes_count:          number
  mes_anterior_bruto: number
  mes_anterior_neto:  number
  mes_anterior_count: number
}
interface Desglose {
  plan:             string
  clientes:         number
  precio_regular:   number
  mrr_actual:       number   // SUM(current_amount) — con promo si aplica
  mrr_comprometido: number   // SUM(regular_amount) — post-promo
  fee_estimado:     number
  mrr_neto_actual:  number
}
interface PorLiberar {
  mp_payment_id:       string
  user_email:          string | null
  transaction_amount:  number
  net_received_amount: number
  money_release_date:  string
  date_approved:       string
}

const loading     = ref(true)
const backfilling = ref(false)
const warnings    = ref<string[]>([])

// Default: mes actual en formato YYYY-MM
const today = new Date()
const mesRef = ref(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`)

const kpis        = ref<Kpis>({ mrr_bruto: 0, mrr_neto: 0, mrr_comprometido: 0, arr_neto: 0, por_liberar: 0, clientes_pagos: 0, clientes_total: 0 })
const movimientos = ref<Movimiento[]>([])
const cobros      = ref<Cobros>({ mes_bruto: 0, mes_fee: 0, mes_taxes: 0, mes_neto: 0, mes_count: 0, mes_anterior_bruto: 0, mes_anterior_neto: 0, mes_anterior_count: 0 })
const desglose    = ref<Desglose[]>([])
const porLiberar  = ref<PorLiberar[]>([])

const mesLabel = computed(() => {
  const [y, m] = mesRef.value.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
})

const resumenMov = computed(() => {
  const sumIf = (pred: (m: Movimiento) => boolean) =>
    movimientos.value.filter(pred).reduce((acc, m) => acc + m.mrr_delta, 0)
  const countIf = (pred: (m: Movimiento) => boolean) =>
    movimientos.value.filter(pred).length

  const nuevoMrr       = sumIf(m => m.movement_type === 'new')
  const expansionMrr   = sumIf(m => m.movement_type === 'expansion')
  const contraccionMrr = sumIf(m => m.movement_type === 'contraction')
  const churnMrr       = sumIf(m => m.movement_type === 'churn')

  const nuevos       = countIf(m => m.movement_type === 'new')
  const expansiones  = countIf(m => m.movement_type === 'expansion')
  const contracciones = countIf(m => m.movement_type === 'contraction')
  const churns       = countIf(m => m.movement_type === 'churn')

  // Churn rate = clientes que se fueron / clientes pagando al inicio del mes.
  // Aproximación: usamos kpis.clientes_pagos actual como denominador.
  const churnRate = kpis.value.clientes_pagos > 0
    ? Math.round((churns / kpis.value.clientes_pagos) * 1000) / 10
    : 0

  const netNew = nuevoMrr + expansionMrr + contraccionMrr + churnMrr

  return { nuevoMrr, expansionMrr, contraccionMrr, churnMrr, nuevos, expansiones, contracciones, churns, churnRate, netNew }
})

const momPct = computed(() => {
  if (!cobros.value.mes_anterior_neto) return 0
  return ((cobros.value.mes_neto - cobros.value.mes_anterior_neto) / cobros.value.mes_anterior_neto) * 100
})

function fmtClp(n: number | null | undefined): string {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n ?? 0)
}

function fmtFecha(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-CL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function labelMov(t: string): string {
  return { new: 'Nuevo', expansion: 'Upgrade', contraction: 'Downgrade', churn: 'Churn', noop: '—' }[t] || t
}

async function cargar() {
  loading.value = true
  warnings.value = []

  const mesDate = `${mesRef.value}-01`

  // Las RPCs admin_finanzas_* no están en los tipos generados de Supabase
  // (las funciones son security definer y se llaman dinámicamente). Usamos
  // any para no pelearnos con el type inference de PostgREST en el cliente.
  type RpcRes<T> = { data: T | null; error: { message: string } | null }
  const sb = supabase as any

  const [kRes, mRes, cRes, dRes, lRes] = await Promise.all([
    sb.rpc('admin_finanzas_kpis')                                  as Promise<RpcRes<Kpis[]>>,
    sb.rpc('admin_finanzas_movimientos', { month_ref: mesDate })   as Promise<RpcRes<Movimiento[]>>,
    sb.rpc('admin_finanzas_cobros',      { month_ref: mesDate })   as Promise<RpcRes<Cobros[]>>,
    sb.rpc('admin_finanzas_desglose_mrr')                          as Promise<RpcRes<Desglose[]>>,
    sb.rpc('admin_finanzas_por_liberar')                           as Promise<RpcRes<PorLiberar[]>>,
  ])

  if (kRes.error) warnings.value.push(`KPIs: ${kRes.error.message}`)
  else if (kRes.data?.[0]) kpis.value = kRes.data[0]

  if (mRes.error) warnings.value.push(`Movimientos: ${mRes.error.message}`)
  else movimientos.value = mRes.data ?? []

  if (cRes.error) warnings.value.push(`Cobros: ${cRes.error.message}`)
  else if (cRes.data?.[0]) cobros.value = cRes.data[0]

  if (dRes.error) warnings.value.push(`Desglose: ${dRes.error.message}`)
  else desglose.value = dRes.data ?? []

  if (lRes.error) warnings.value.push(`Por liberar: ${lRes.error.message}`)
  else porLiberar.value = lRes.data ?? []

  loading.value = false
}

async function ejecutarBackfill() {
  if (backfilling.value) return
  backfilling.value = true
  try {
    const res = await $fetch<{
      ok: boolean
      pages_processed?: number
      fetched?: number
      upserted?: number
      failed?: number
      error?: string
    }>('/api/admin/backfill-payments', { method: 'POST' })
    if (res.ok) {
      warnings.value.push(`Backfill OK: ${res.upserted} upserts en ${res.pages_processed} páginas (${res.failed} fallidos)`)
      await cargar()
    } else {
      warnings.value.push(`Backfill falló: ${res.error}`)
    }
  } catch (err: any) {
    warnings.value.push(`Backfill error: ${err?.message ?? 'desconocido'}`)
  } finally {
    backfilling.value = false
  }
}

watch(mesRef, () => cargar())
onMounted(() => cargar())
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.content { flex: 1; padding: 2rem 2.5rem; font-family: 'Inter', sans-serif; }
.header { margin-bottom: 1.75rem; display: flex; justify-content: space-between; align-items: flex-end; gap: 1rem; flex-wrap: wrap; }
.header-actions { display: flex; gap: 0.625rem; align-items: center; }
h1 { font-size: 1.625rem; font-weight: 700; color: #0f172a; letter-spacing: -0.025em; }
.subtitle { font-size: 0.875rem; color: #64748b; margin-top: 0.2rem; }
.loading { padding: 3rem; text-align: center; color: #64748b; font-size: 0.9rem; }
.empty { padding: 1.5rem; text-align: center; color: #94a3b8; font-size: 0.875rem; }

.month-input {
  padding: 0.5rem 0.75rem; border: 1px solid #e2e8f0; border-radius: 8px;
  font-family: 'Inter', sans-serif; font-size: 0.875rem; color: #0f172a; background: white;
}
.btn-backfill {
  padding: 0.5rem 1rem; background: #0ea5e9; color: white; border: none; border-radius: 8px;
  font-weight: 600; font-size: 0.8125rem; cursor: pointer; transition: background 0.15s;
}
.btn-backfill:hover:not(:disabled) { background: #0284c7; }
.btn-backfill:disabled { opacity: 0.6; cursor: progress; }

.stats-row { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 2rem; }
.stat-card {
  background: white; border: 1px solid #e2e8f0; border-radius: 12px;
  padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 0.2rem; min-width: 180px; flex: 1;
}
.stat-num { font-size: 1.75rem; font-weight: 800; color: #0f172a; line-height: 1; }
.stat-label { font-size: 0.8125rem; color: #64748b; font-weight: 500; }
.stat-sub { font-size: 0.75rem; color: #94a3b8; }
.accent-green .stat-num { color: #16a34a; }
.accent-blue .stat-num { color: #0ea5e9; }

.section {
  background: white; border: 1px solid #e2e8f0; border-radius: 12px;
  padding: 1.5rem; margin-bottom: 1.5rem;
}
h2 { font-size: 0.875rem; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1.25rem; }
.h2-sub { font-size: 0.75rem; color: #94a3b8; text-transform: none; letter-spacing: 0; font-weight: 500; margin-left: 0.5rem; }

/* MRR grid */
.mrr-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 0.75rem;
}
.mrr-cell {
  background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;
  padding: 1rem; display: flex; flex-direction: column; gap: 0.25rem;
}
.mrr-cell.positive { border-left: 3px solid #16a34a; }
.mrr-cell.negative { border-left: 3px solid #dc2626; }
.mrr-cell.net { background: #f0f9ff; border-color: #bae6fd; }
.mrr-label { font-size: 0.75rem; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
.mrr-num { font-size: 1.25rem; font-weight: 800; color: #0f172a; }
.mrr-sub { font-size: 0.75rem; color: #94a3b8; }

/* Cobros grid */
.cobros-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1rem;
}
.cobros-card {
  background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 1.25rem;
}
.cobros-card.cobros-prev { background: #f8fafc; border-color: #e2e8f0; }
.cobros-titulo { font-size: 0.75rem; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
.cobros-num { font-size: 1.75rem; font-weight: 800; color: #16a34a; margin: 0.4rem 0 0.875rem; }
.cobros-prev .cobros-num { color: #475569; }
.cobros-detalle { display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.8125rem; }
.cobros-detalle > div { display: flex; justify-content: space-between; color: #475569; }
.cobros-detalle .row-total { border-top: 1px solid #e2e8f0; padding-top: 0.4rem; margin-top: 0.2rem; }

.nota {
  font-size: 0.8125rem; color: #64748b; margin-top: 1rem;
  padding: 0.75rem 1rem; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px;
}

/* Tabla */
.tabla-title { font-size: 0.8rem; font-weight: 600; color: #475569; margin-bottom: 0.625rem; }
.tabla { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.tabla th {
  text-align: left; font-size: 0.75rem; font-weight: 600; color: #94a3b8;
  padding: 0.5rem 0.75rem; border-bottom: 1px solid #f1f5f9; text-transform: uppercase; letter-spacing: 0.04em;
}
.tabla td {
  padding: 0.625rem 0.75rem; border-bottom: 1px solid #f8fafc; color: #374151; vertical-align: middle;
}
.tabla tr:last-child td { border-bottom: none; }
.tabla tr:hover td { background: #f8fafc; }
.col-num { text-align: right; white-space: nowrap; }
.text-muted { color: #94a3b8; font-size: 0.8125rem; }
.text-mono { font-size: 0.8125rem; color: #475569; font-family: ui-monospace, SFMono-Regular, monospace; }
.text-pos { color: #16a34a; }
.text-neg { color: #dc2626; }

/* Badges */
.badge {
  display: inline-block; font-size: 0.7rem; font-weight: 700;
  padding: 0.15rem 0.5rem; border-radius: 999px;
}
.badge-new         { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
.badge-expansion   { background: #dbeafe; color: #1d4ed8; border: 1px solid #93c5fd; }
.badge-contraction { background: #fef3c7; color: #a16207; border: 1px solid #fcd34d; }
.badge-churn       { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }
.badge-noop        { background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; }

.plan-tag {
  display: inline-block; font-size: 0.75rem; font-weight: 700;
  padding: 0.2rem 0.6rem; border-radius: 6px; text-transform: capitalize;
}
.plan-starter  { background: #f0f9ff; color: #0369a1; border: 1px solid #bae6fd; }
.plan-advanced { background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; }
.plan-agency   { background: #ecfeff; color: #0e7490; border: 1px solid #a5f3fc; }

.warning-box {
  background: #fffbeb; border: 1px solid #fde68a; color: #92400e;
  padding: 0.875rem 1rem; border-radius: 10px; font-size: 0.8125rem; margin-bottom: 1.5rem;
}
.warning-box ul { margin-top: 0.4rem; padding-left: 1.5rem; }
</style>
