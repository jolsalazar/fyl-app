<template>
  <NuxtLayout name="dashboard">
    <div class="content">
      <div class="header">
        <div>
          <h1>Suscripción</h1>
          <p class="subtitle">Estado de tu plan y próximos cobros</p>
        </div>
      </div>

      <!-- Cargando -->
      <div v-if="cargando" class="card empty">
        <span class="spinner"></span>
        <p>Cargando…</p>
      </div>

      <!-- Sin suscripción: usuario solo Free -->
      <div v-else-if="!sub" class="card empty">
        <p class="empty-icon">🌱</p>
        <h2>Estás en el plan Free</h2>
        <p>Para acceder a alertas ilimitadas, Mi Match y más, contrata un plan pagado.</p>
        <NuxtLink to="/planes" class="btn-primary">Ver planes</NuxtLink>
      </div>

      <!-- Con suscripción -->
      <template v-else>
        <!-- Warning: múltiples suscripciones activas (no debería pasar con
             el unique partial index, pero defensa en profundidad) -->
        <div v-if="multipleActivas" class="aviso aviso-warning">
          <strong>Detectamos múltiples suscripciones activas en tu cuenta.</strong>
          <p>Por favor escríbenos a <a href="mailto:hola@fondosylicitaciones.cl">hola@fondosylicitaciones.cl</a> para que lo revisemos.</p>
        </div>
        <!-- Estado pendiente: el usuario llegó al checkout pero aún no autorizó -->
        <section v-if="sub.status === 'pending'" class="card aviso-card">
          <div class="card-header">
            <h2>Plan {{ planNombre }}</h2>
            <span class="badge badge-paused">Pendiente</span>
          </div>
          <p>Tu suscripción está esperando autorización en MercadoPago. Si ya completaste el pago, puede tardar unos minutos en activarse.</p>
          <p style="margin-top:0.5rem">Si no completaste el pago, <NuxtLink to="/planes" class="link">haz clic aquí para intentarlo de nuevo</NuxtLink>.</p>
        </section>

        <!-- Estado activo -->
        <section v-if="sub.status === 'authorized'" class="card">
          <div class="card-header">
            <h2>Plan {{ planNombre }}</h2>
            <span class="badge badge-active">Activa</span>
          </div>

          <div class="row">
            <span class="row-label">Monto actual</span>
            <span class="row-value"><strong>${{ formatear(sub.current_amount) }}</strong> / mes</span>
          </div>

          <div v-if="sub.promo_applied === false && sub.promo_ends_at" class="row">
            <span class="row-label">Promo válida hasta</span>
            <span class="row-value">
              {{ fechaFmt(sub.promo_ends_at) }}
              <span class="row-sub">luego ${{ formatear(sub.regular_amount) }}/mes</span>
            </span>
          </div>

          <div v-if="proximoCobro" class="row">
            <span class="row-label">{{ proximoCobroEsEstimado ? 'Próximo cobro estimado' : 'Próximo cobro' }}</span>
            <span class="row-value">{{ fechaFmt(proximoCobro) }}</span>
          </div>

          <div v-if="sub.last_payment_at" class="row">
            <span class="row-label">Último cobro</span>
            <span class="row-value">{{ fechaFmt(sub.last_payment_at) }}</span>
          </div>

          <div v-if="sub.started_at" class="row">
            <span class="row-label">Suscripción desde</span>
            <span class="row-value">{{ fechaFmt(sub.started_at) }}</span>
          </div>
        </section>

        <!-- Aviso de promo terminando pronto -->
        <div v-if="avisoPromo" class="aviso aviso-info">
          <strong>Tu período promocional termina el {{ fechaFmt(sub.promo_ends_at!) }}.</strong>
          <p>A partir de esa fecha el cobro pasa a <strong>${{ formatear(sub.regular_amount) }}/mes</strong>. El cambio es automático, no tienes que hacer nada.</p>
        </div>

        <!-- Estado pausado -->
        <section v-if="sub.status === 'paused'" class="card aviso-card">
          <div class="card-header">
            <h2>Plan {{ planNombre }}</h2>
            <span class="badge badge-paused">Pausada</span>
          </div>
          <p>Tuvimos problemas cobrando tu plan. MercadoPago intentará nuevamente. Si persiste, escríbenos a <a href="mailto:hola@fondosylicitaciones.cl">hola@fondosylicitaciones.cl</a>.</p>
        </section>

        <!-- Estado cancelado -->
        <section v-if="sub.status === 'cancelled'" class="card">
          <div class="card-header">
            <h2>Plan {{ planNombre }}</h2>
            <span class="badge badge-cancelled">Cancelada</span>
          </div>
          <p v-if="sub.cancelled_at">Cancelada el {{ fechaFmt(sub.cancelled_at) }}.</p>
          <p>Pasaste al plan Free. Puedes contratar de nuevo cuando quieras.</p>
          <NuxtLink to="/planes" class="btn-primary" style="margin-top:1rem">Ver planes</NuxtLink>
        </section>

        <!-- Acciones para suscripción activa -->
        <section v-if="sub.status === 'authorized'" class="actions-card">
          <div v-if="!confirmandoCancelar">
            <button class="btn-cancelar" @click="confirmandoCancelar = true">
              Cancelar suscripción
            </button>
            <p class="actions-note">Tu plan pasa a Free de inmediato. No hay reembolso por días no usados.</p>
          </div>

          <div v-else class="confirm">
            <p><strong>¿Seguro que quieres cancelar?</strong></p>
            <p class="confirm-text">Pasarás al plan Free de inmediato y dejarás de tener acceso a las funciones del plan {{ planNombre }}.</p>
            <div class="confirm-actions">
              <button class="btn-cancelar" :disabled="cancelando" @click="cancelar">
                <span v-if="cancelando" class="spinner"></span>
                {{ cancelando ? 'Cancelando…' : 'Sí, cancelar' }}
              </button>
              <button class="btn-ghost" :disabled="cancelando" @click="confirmandoCancelar = false">
                Volver
              </button>
            </div>
          </div>
        </section>
      </template>

      <AppToast />
    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { PLANES_CONFIG, esPlanValido, type Plan } from '~~/utils/planes'

definePageMeta({ middleware: 'auth', layout: false })

const { show: toast } = useToast()

type Subscription = {
  id:               string
  plan:             Plan
  status:           'pending' | 'authorized' | 'paused' | 'cancelled'
  current_amount:   number
  regular_amount:   number
  promo_applied:    boolean
  promo_ends_at:    string | null
  started_at:       string | null
  last_payment_at:  string | null
  cancelled_at:     string | null
  created_at:       string
}

const sub                  = ref<Subscription | null>(null)
const nextPaymentDate      = ref<string | null>(null)
const multipleActivas      = ref(false)
const cargando             = ref(true)
const confirmandoCancelar  = ref(false)
const cancelando           = ref(false)

const planNombre = computed(() => sub.value && esPlanValido(sub.value.plan)
  ? PLANES_CONFIG[sub.value.plan].nombre
  : '')

// Próximo cobro: preferir next_payment_date real de MP (cuando el endpoint lo
// pudo obtener); si no, estimar (último cobro o inicio) + 1 mes.
const proximoCobro = computed(() => {
  if (!sub.value || sub.value.status !== 'authorized') return null
  if (nextPaymentDate.value) return nextPaymentDate.value
  const base = sub.value.last_payment_at ?? sub.value.started_at
  if (!base) return null
  const d = new Date(base)
  d.setMonth(d.getMonth() + 1)
  return d.toISOString()
})

const proximoCobroEsEstimado = computed(() =>
  Boolean(sub.value && sub.value.status === 'authorized' && !nextPaymentDate.value),
)

// Aviso de promo solo si está activa, sin promo aplicada todavía, y la fecha de
// cambio está a 14 días o menos
const avisoPromo = computed(() => {
  if (!sub.value || sub.value.status !== 'authorized') return false
  if (sub.value.promo_applied || !sub.value.promo_ends_at) return false
  const dias = (new Date(sub.value.promo_ends_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
  return dias > 0 && dias <= 14
})

function formatear(n: number): string {
  return n.toLocaleString('es-CL')
}

function fechaFmt(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

async function cargar() {
  cargando.value = true
  try {
    const res = await $fetch<{
      ok: boolean
      suscripcion: Subscription | null
      multiple_activas: boolean
      next_payment_date: string | null
    }>('/api/suscripcion/estado')
    sub.value             = res.suscripcion
    nextPaymentDate.value = res.next_payment_date
    multipleActivas.value = res.multiple_activas
  } catch {
    toast('No pudimos cargar tu suscripción.', 'error')
  } finally {
    cargando.value = false
  }
}

async function cancelar() {
  if (cancelando.value) return
  cancelando.value = true
  try {
    const res = await $fetch<{ ok: boolean; error?: string }>('/api/suscripcion/cancelar', { method: 'POST' })
    if (res.ok) {
      toast('Suscripción cancelada. Pasaste al plan Free.', 'ok', 5000)
      confirmandoCancelar.value = false
      await cargar()
    } else {
      toast('No pudimos cancelar. Intenta de nuevo o escríbenos.', 'error')
    }
  } catch {
    toast('No pudimos cancelar. Intenta de nuevo o escríbenos.', 'error')
  } finally {
    cancelando.value = false
  }
}

onMounted(cargar)
</script>

<style scoped>
.content { max-width: 720px; margin: 0 auto; padding: 2rem 1.5rem; }
.header { margin-bottom: 1.75rem; }
h1 { font-size: 1.625rem; font-weight: 800; color: #0f172a; letter-spacing: -0.025em; }
.subtitle { font-size: 0.9375rem; color: #64748b; margin-top: 0.25rem; }

.card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 1.5rem;
  margin-bottom: 1rem;
}
.card-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 1.25rem;
}
.card-header h2 { font-size: 1.125rem; font-weight: 700; color: #0f172a; }

.badge {
  font-size: 0.75rem; font-weight: 700; padding: 0.25rem 0.625rem;
  border-radius: 999px; letter-spacing: 0.02em;
}
.badge-active    { background: #f0fdf4; color: #15803d; }
.badge-paused    { background: #fef3c7; color: #92400e; }
.badge-cancelled { background: #f1f5f9; color: #64748b; }

.row {
  display: flex; justify-content: space-between; align-items: flex-start;
  padding: 0.75rem 0;
  border-top: 1px solid #f1f5f9;
}
.row:first-of-type { border-top: none; padding-top: 0; }
.row-label { font-size: 0.875rem; color: #64748b; }
.row-value { font-size: 0.875rem; color: #0f172a; text-align: right; }
.row-value strong { font-weight: 700; }
.row-sub { display: block; font-size: 0.75rem; color: #94a3b8; margin-top: 0.15rem; }

.empty { text-align: center; padding: 3rem 1.5rem; }
.empty-icon { font-size: 2.5rem; margin-bottom: 0.75rem; }
.empty h2 { font-size: 1.25rem; font-weight: 700; color: #0f172a; margin-bottom: 0.5rem; }
.empty p { font-size: 0.9375rem; color: #64748b; line-height: 1.55; margin-bottom: 1.25rem; }

.btn-primary {
  display: inline-flex; align-items: center; justify-content: center;
  background: #0ea5e9; color: white;
  font-size: 0.875rem; font-weight: 600;
  padding: 0.7rem 1.25rem; border-radius: 10px;
  text-decoration: none; border: none; cursor: pointer;
  transition: background 0.15s;
}
.btn-primary:hover { background: #0284c7; }

.aviso {
  border-radius: 10px; padding: 1rem 1.25rem; margin-bottom: 1rem;
  font-size: 0.875rem; line-height: 1.5;
}
.aviso strong { display: block; margin-bottom: 0.25rem; }
.aviso p { margin: 0; font-size: 0.8125rem; }
.aviso-info { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; }
.aviso-warning { background: #fef3c7; border: 1px solid #fde68a; color: #92400e; }
.aviso-warning a { color: #92400e; text-decoration: underline; }

.aviso-card { background: #fffbeb; border-color: #fde68a; }
.aviso-card p { font-size: 0.875rem; color: #92400e; }
.aviso-card a { color: #92400e; text-decoration: underline; }
.link { color: inherit; text-decoration: underline; }

.actions-card {
  background: white; border: 1px solid #e2e8f0;
  border-radius: 14px; padding: 1.25rem 1.5rem;
}
.actions-note { font-size: 0.75rem; color: #94a3b8; margin-top: 0.5rem; }

.btn-cancelar {
  background: transparent; border: 1px solid #fecaca; color: #dc2626;
  font-size: 0.875rem; font-weight: 600;
  padding: 0.6rem 1.125rem; border-radius: 10px;
  cursor: pointer; font-family: inherit;
  display: inline-flex; align-items: center; gap: 0.5rem;
  transition: background 0.15s;
}
.btn-cancelar:hover:not(:disabled) { background: #fef2f2; }
.btn-cancelar:disabled { opacity: 0.6; cursor: progress; }

.confirm p { font-size: 0.9375rem; color: #0f172a; margin-bottom: 0.5rem; }
.confirm-text { font-size: 0.875rem !important; color: #64748b !important; }
.confirm-actions { display: flex; gap: 0.625rem; margin-top: 1rem; }

.btn-ghost {
  background: white; border: 1px solid #e2e8f0; color: #475569;
  font-size: 0.875rem; font-weight: 600;
  padding: 0.6rem 1.125rem; border-radius: 10px;
  cursor: pointer; font-family: inherit;
}
.btn-ghost:hover:not(:disabled) { background: #f8fafc; }

.spinner {
  width: 14px; height: 14px;
  border: 2px solid rgba(220,38,38,0.25); border-top-color: #dc2626;
  border-radius: 50%;
  animation: spin 0.65s linear infinite;
  display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>
