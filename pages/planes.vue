<template>
  <div class="page">

    <div class="header">
      <NuxtLink to="/dashboard" class="back">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        Volver
      </NuxtLink>
      <div class="header-text">
        <h1>Elige tu plan</h1>
        <p>Empieza gratis y mejora cuando lo necesites. Sin permanencia.</p>
      </div>
      <div class="plan-actual" v-if="plan !== 'free'">
        <span>Plan actual:</span>
        <strong>{{ label }}</strong>
      </div>
    </div>

    <div class="planes">

      <!-- FREE -->
      <div class="plan-card" :class="{ current: plan === 'free' }">
        <div class="plan-top">
          <div class="plan-name">Free</div>
          <div class="plan-price"><span class="price-num">$0</span><span class="price-per">/mes</span></div>
          <p class="price-promo-note price-promo-spacer" aria-hidden="true">&nbsp;<br>&nbsp;</p>
          <p class="plan-desc">Para explorar el ecosistema de fondos y mantenerte informado.</p>
        </div>
        <ul class="features">
          <li class="ok">Explorar todas las oportunidades</li>
          <li class="ok">Guardar favoritos</li>
          <li class="ok">Calendario de cierres</li>
          <li class="ok">1 alerta activa</li>
          <li class="no">Notificaciones por email</li>
          <li class="no">Mis Match (scoring)</li>
          <li class="no">Múltiples alertas</li>
        </ul>
        <div class="plan-action">
          <span v-if="plan === 'free'" class="btn-current">Plan actual</span>
          <a v-else href="mailto:hola@fondosylicitaciones.cl?subject=Cambio a plan Free" class="btn-downgrade">Cambiar a Free</a>
        </div>
      </div>

      <!-- STARTER -->
      <div class="plan-card" :class="{ current: plan === 'starter' }">
        <div class="plan-top">
          <div class="plan-name">Starter</div>
          <div class="plan-price"><span class="price-num">${{ PLANES_CONFIG.starter.precio_promo.toLocaleString() }}</span><span class="price-per">/mes</span></div>
          <p class="price-promo-note">
            los primeros 3 meses<br>
            <span class="price-regular">luego ${{ PLANES_CONFIG.starter.precio_regular.toLocaleString() }}/mes</span>
          </p>
          <p class="plan-desc">Para emprendedores activos que quieren estar siempre al tanto.</p>
        </div>
        <ul class="features">
          <li class="ok">Todo lo del plan Free</li>
          <li class="ok">Hasta 3 alertas activas</li>
          <li class="ok">Notificaciones por email (diarias)</li>
          <li class="no">Mis Match (scoring de compatibilidad)</li>
          <li class="no">Análisis de elegibilidad</li>
        </ul>
        <div class="plan-action">
          <span v-if="plan === 'starter'" class="btn-current">Plan actual</span>
          <button v-else-if="mpEnabled" class="btn-upgrade btn-starter" :disabled="contratando === 'starter'" @click="contratar('starter')">
            <span v-if="contratando === 'starter'" class="spinner"></span>
            {{ contratando === 'starter' ? 'Redirigiendo…' : (esMejor('starter') ? 'Mejorar a Starter' : 'Cambiar a Starter') }}
          </button>
          <a v-else href="mailto:hola@fondosylicitaciones.cl?subject=Quiero el plan Starter" class="btn-upgrade btn-starter">
            {{ esMejor('starter') ? 'Mejorar a Starter' : 'Cambiar a Starter' }}
          </a>
        </div>
      </div>

      <!-- ADVANCED -->
      <div class="plan-card plan-featured" :class="{ current: plan === 'advanced' }">
        <div class="featured-badge">Más popular</div>
        <div class="plan-top">
          <div class="plan-name">Advanced</div>
          <div class="plan-price"><span class="price-num">${{ PLANES_CONFIG.advanced.precio_promo.toLocaleString() }}</span><span class="price-per">/mes</span></div>
          <p class="price-promo-note">
            los primeros 3 meses<br>
            <span class="price-regular">luego ${{ PLANES_CONFIG.advanced.precio_regular.toLocaleString() }}/mes</span>
          </p>
          <p class="plan-desc">Para quienes postulan activamente y quieren postular solo donde califican.</p>
        </div>
        <ul class="features">
          <li class="ok">Todo lo del plan Starter</li>
          <li class="ok">Alertas ilimitadas</li>
          <li class="ok">Mis Match — score de compatibilidad fondo a fondo</li>
          <li class="ok">Razones concretas de por qué calificas o no</li>
          <li class="ok">Resultados ordenados por compatibilidad</li>
          <li class="no">Gestión multi-cliente</li>
        </ul>
        <div class="plan-action">
          <span v-if="plan === 'advanced'" class="btn-current">Plan actual</span>
          <button v-else-if="mpEnabled" class="btn-upgrade btn-pro" :disabled="contratando === 'advanced'" @click="contratar('advanced')">
            <span v-if="contratando === 'advanced'" class="spinner"></span>
            {{ contratando === 'advanced' ? 'Redirigiendo…' : (esMejor('advanced') ? 'Mejorar a Advanced' : 'Cambiar a Advanced') }}
          </button>
          <a v-else href="mailto:hola@fondosylicitaciones.cl?subject=Quiero el plan Advanced" class="btn-upgrade btn-pro">
            {{ esMejor('advanced') ? 'Mejorar a Advanced' : 'Cambiar a Advanced' }}
          </a>
        </div>
      </div>

      <!-- AGENCY -->
      <div class="plan-card" :class="{ current: plan === 'agency' }">
        <div class="plan-top">
          <div class="plan-name">Agency</div>
          <div class="plan-price"><span class="price-num">${{ PLANES_CONFIG.agency.precio.toLocaleString() }}</span><span class="price-per">/mes</span></div>
          <p class="price-promo-note price-promo-spacer" aria-hidden="true">&nbsp;<br>&nbsp;</p>
          <p class="plan-desc">Para consultoras y agencias que gestionan múltiples clientes y proyectos.</p>
        </div>
        <ul class="features">
          <li class="ok">Todo lo del plan Advanced</li>
          <li class="ok">Gestión multi-cliente</li>
          <li class="ok">Reportes exportables</li>
          <li class="ok">Soporte prioritario</li>
        </ul>
        <div class="plan-action">
          <span v-if="plan === 'agency'" class="btn-current">Plan actual</span>
          <button v-else-if="mpEnabled" class="btn-upgrade btn-agency" :disabled="contratando === 'agency'" @click="contratar('agency')">
            <span v-if="contratando === 'agency'" class="spinner"></span>
            {{ contratando === 'agency' ? 'Redirigiendo…' : (esMejor('agency') ? 'Mejorar a Agency' : 'Contratar') }}
          </button>
          <a v-else href="mailto:hola@fondosylicitaciones.cl?subject=Quiero el plan Agency" class="btn-upgrade btn-agency">
            {{ esMejor('agency') ? 'Mejorar a Agency' : 'Contactar' }}
          </a>
        </div>
      </div>

    </div>

    <p v-if="!mpEnabled" class="nota">
      Por ahora el cambio de plan se gestiona por email. Pronto tendremos pago en línea.
      Escríbenos a <a href="mailto:hola@fondosylicitaciones.cl">hola@fondosylicitaciones.cl</a>
    </p>
    <p v-else class="nota">
      El pago se procesa en MercadoPago. Tu plan se activa automáticamente al confirmarse el pago.
    </p>

    <AppToast />
  </div>
</template>

<script setup lang="ts">
import { PLANES_CONFIG } from '~~/utils/planes'

definePageMeta({ middleware: 'auth' })

const { plan, label, esMejor, load } = usePlan()
const { contratar: contratarPlan } = useContratarPlan()
const route   = useRoute()
const router  = useRouter()

const mpEnabled   = computed(() => Boolean(useRuntimeConfig().public.mpEnabled))
const contratando = ref<'starter' | 'advanced' | 'agency' | null>(null)

async function contratar(p: 'starter' | 'advanced' | 'agency') {
  if (contratando.value) return
  contratando.value = p
  await contratarPlan(p)
  contratando.value = null
}

onMounted(() => {
  load()
  const pago = route.query.pago
  if (pago === 'falla') {
    toast('El pago no se pudo completar. No se hizo ningún cobro.', 'error', 5000)
    router.replace({ query: {} })
  }
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.page {
  min-height: 100vh; background: #f1f5f9;
  font-family: 'Inter', sans-serif; padding: 2.5rem 1.5rem;
}

.header {
  display: flex; align-items: center; gap: 1.5rem;
  max-width: 1100px; margin: 0 auto 2.5rem; flex-wrap: wrap;
}
.back {
  display: inline-flex; align-items: center; gap: 0.4rem;
  font-size: 0.875rem; color: #64748b; text-decoration: none; font-weight: 500;
  transition: color 0.15s; flex-shrink: 0;
}
.back:hover { color: #0f172a; }
.header-text { flex: 1; }
h1 { font-size: 1.75rem; font-weight: 800; color: #0f172a; letter-spacing: -0.03em; }
.header-text p { font-size: 0.9375rem; color: #64748b; margin-top: 0.25rem; }
.plan-actual { display: flex; align-items: center; gap: 0.4rem; font-size: 0.875rem; color: #64748b; }
.plan-actual strong { color: #0f172a; font-weight: 700; }

/* Grid de planes */
.planes {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  max-width: 1100px;
  margin: 0 auto;
  align-items: start;
}

.plan-card {
  background: white; border: 1.5px solid #e2e8f0; border-radius: 16px;
  padding: 1.75rem; display: flex; flex-direction: column; gap: 1.5rem;
  position: relative; transition: box-shadow 0.15s;
}
.plan-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.07); }
.plan-card.current { border-color: #0ea5e9; }

.plan-featured {
  border-color: #6366f1;
  box-shadow: 0 4px 24px rgba(99,102,241,0.15);
}
.plan-featured:hover { box-shadow: 0 8px 32px rgba(99,102,241,0.2); }

.featured-badge {
  position: absolute; top: -12px; left: 50%; transform: translateX(-50%);
  background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white;
  font-size: 0.7rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;
  padding: 0.25rem 0.875rem; border-radius: 999px;
}

.plan-name { font-size: 0.875rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 0.5rem; }
.plan-price { display: flex; align-items: baseline; gap: 0.2rem; margin-bottom: 0.625rem; }
.price-num { font-size: 2rem; font-weight: 800; color: #0f172a; letter-spacing: -0.04em; line-height: 1; }
.price-promo-note { font-size: 0.7rem; color: #94a3b8; line-height: 1.5; margin: 0.5rem 0 0.625rem; font-weight: 500; }
.price-promo-note .price-regular { color: #475569; font-weight: 600; }
.price-promo-spacer { visibility: hidden; }
.price-per { font-size: 0.875rem; color: #94a3b8; }
.plan-desc { font-size: 0.8375rem; color: #64748b; line-height: 1.55; }

/* Features */
.features { list-style: none; display: flex; flex-direction: column; gap: 0.5rem; flex: 1; }
.features li { display: flex; align-items: flex-start; gap: 0.5rem; font-size: 0.8375rem; line-height: 1.4; }
.features li::before { flex-shrink: 0; width: 16px; height: 16px; border-radius: 50%; font-size: 0.65rem; font-weight: 800; display: flex; align-items: center; justify-content: center; margin-top: 0.1rem; }
.features li.ok { color: #374151; }
.features li.ok::before { content: '✓'; background: #f0fdf4; color: #16a34a; }
.features li.no { color: #94a3b8; }
.features li.no::before { content: '–'; background: #f8fafc; color: #cbd5e1; }

/* Acciones */
.plan-action { margin-top: auto; }
.btn-current {
  display: block; text-align: center; padding: 0.7rem;
  background: #f1f5f9; color: #64748b; font-size: 0.875rem;
  font-weight: 600; border-radius: 10px; border: 1.5px solid #e2e8f0;
}
.btn-upgrade {
  display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  width: 100%; padding: 0.7rem;
  color: white; font-size: 0.875rem; font-weight: 700; font-family: inherit;
  border: none; border-radius: 10px; text-decoration: none; cursor: pointer;
  transition: opacity 0.15s;
}
.btn-upgrade:hover:not(:disabled) { opacity: 0.9; }
.btn-upgrade:disabled { opacity: 0.7; cursor: progress; }
.spinner {
  width: 14px; height: 14px;
  border: 2px solid rgba(255,255,255,0.4); border-top-color: white;
  border-radius: 50%; animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.btn-starter { background: #f59e0b; }
.btn-pro     { background: linear-gradient(135deg, #6366f1, #8b5cf6); box-shadow: 0 4px 12px rgba(99,102,241,0.3); }
.btn-agency { background: #0f172a; }
.btn-downgrade {
  display: block; text-align: center; padding: 0.7rem;
  background: white; border: 1.5px solid #e2e8f0; color: #94a3b8;
  font-size: 0.875rem; font-weight: 500; border-radius: 10px; text-decoration: none;
}

.nota {
  max-width: 1100px; margin: 1.5rem auto 0;
  font-size: 0.8125rem; color: #94a3b8; text-align: center; line-height: 1.6;
}
.nota a { color: #0ea5e9; text-decoration: none; }
.nota a:hover { text-decoration: underline; }

@media (max-width: 900px) {
  .planes { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 560px) {
  .planes { grid-template-columns: 1fr; }
  h1 { font-size: 1.5rem; }
}
</style>
