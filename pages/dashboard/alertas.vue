<template>
  <NuxtLayout name="dashboard">
    <div class="content">

      <!-- ── VISTA: FORMULARIO ─────────────────────────────────── -->
      <template v-if="view === 'form'">
        <div class="form-page">
          <button class="back-btn" @click="cancelarForm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Volver a alertas
          </button>
          <h1>{{ editingAlerta ? `Editar "${editingAlerta.nombre || 'Alerta'}"` : 'Nueva alerta' }}</h1>
          <p class="form-desc">Define los criterios para esta alerta. Te enviaremos un email los días que aparezcan oportunidades nuevas que coincidan — si tus filtros son específicos, puede pasar algún día sin novedades.</p>


          <div class="form-grid">
            <!-- Nombre -->
            <section class="card full-width">
              <div class="card-header"><h2>Nombre de la alerta</h2></div>
              <input v-model="form.nombre" type="text" class="text-input" placeholder="ej: Fondos CORFO, Licitaciones Norte…" required />
            </section>

            <div class="basicos-label full-width">
              <span>Filtros básicos</span>
            </div>

            <!-- Tipo -->
            <section class="card">
              <div class="card-header">
                <h2>Tipo de oportunidad</h2>
                <p class="hint">Vacío = ambos.</p>
              </div>
              <div class="checks">
                <label class="check-item">
                  <input type="checkbox" value="fondo" v-model="form.tipos" /><span class="check-box"></span>Fondos concursables
                </label>
                <label class="check-item">
                  <input type="checkbox" value="licitacion" v-model="form.tipos" /><span class="check-box"></span>Licitaciones
                </label>
              </div>
            </section>

            <!-- Fuentes -->
            <section class="card">
              <div class="card-header">
                <h2>Fuentes</h2>
                <p class="hint">Vacío = todas.</p>
              </div>
              <div class="checks">
                <label v-for="f in FUENTES" :key="f.value" class="check-item">
                  <input type="checkbox" :value="f.value" v-model="form.fuentes" /><span class="check-box"></span>{{ f.label }}
                </label>
              </div>
            </section>

            <!-- Alcance + Monto -->
            <section class="card">
              <div class="card-header"><h2>Alcance</h2></div>
              <div class="checks">
                <label v-for="a in ALCANCES" :key="a.value" class="check-item">
                  <input type="checkbox" :value="a.value" v-model="form.alcance_interes" /><span class="check-box"></span>{{ a.label }}
                </label>
              </div>
            </section>

            <section class="card">
              <div class="card-header">
                <h2>Monto mínimo</h2>
                <p class="hint">Muestra desde este monto en adelante.</p>
              </div>
              <select v-model="form.monto_minimo" class="select-input">
                <option value="">Sin límite</option>
                <option v-for="m in MONTOS" :key="m.value" :value="m.value">{{ m.label }}</option>
              </select>
            </section>

            <!-- Filtros avanzados (colapsable) -->
            <div class="avanzados-wrap full-width">
              <button type="button" class="avanzados-toggle" @click="showAvanzados = !showAvanzados">
                <span>Filtros avanzados</span>
                <span v-if="form.foco.length || form.palabras_clave.length" class="avanzados-badge">
                  {{ form.foco.length + form.palabras_clave.length }}
                </span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" :style="{ transform: showAvanzados ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div v-show="showAvanzados" class="avanzados-content">
                <section class="card">
                  <div class="card-header">
                    <h2>Foco del proyecto</h2>
                    <p class="hint">Filtra solo oportunidades que coincidan con estos sectores. Vacío = todos.</p>
                  </div>
                  <div class="checks-grid-3">
                    <label v-for="f in FOCOS" :key="f" class="check-item">
                      <input type="checkbox" :value="f" v-model="form.foco" /><span class="check-box"></span>{{ f }}
                    </label>
                  </div>
                </section>
                <section class="card">
                  <div class="card-header">
                    <h2>Palabras clave</h2>
                    <p class="hint">Busca estas palabras en título y descripción. Presiona Enter para agregar.</p>
                  </div>
                  <div class="tags-input">
                    <span v-for="(tag, i) in form.palabras_clave" :key="i" class="tag">
                      {{ tag }}<button type="button" @click="removeTag(i)">×</button>
                    </span>
                    <input
                      v-model="tagInput"
                      type="text"
                      placeholder="ej: reciclaje, software, exportación…"
                      @keydown.enter.prevent="addTag"
                      @keydown.comma.prevent="addTag"
                    />
                  </div>
                </section>
              </div>
            </div>
          </div>

          <div class="form-actions">
            <div v-if="formMsg" :class="['mensaje', formError ? 'error' : 'ok']">{{ formMsg }}</div>
            <button class="btn-save" @click="guardarAlerta" :disabled="guardando || !form.nombre.trim()">
              <span v-if="guardando" class="spinner-btn"></span>
              {{ guardando ? 'Guardando...' : (editingAlerta ? 'Guardar cambios' : 'Crear alerta') }}
            </button>
            <button class="btn-cancel" @click="cancelarForm">Cancelar</button>
          </div>
        </div>
      </template>

      <!-- ── VISTA: LISTA + RESULTADOS ─────────────────────────── -->
      <template v-else>

        <!-- Loading skeleton -->
        <div v-if="loading" class="split">
          <div class="panel-left">
            <div class="panel-header">
              <div class="sk-block" style="width:80px;height:13px;border-radius:6px"></div>
            </div>
            <div class="alertas-nav">
              <div v-for="i in 4" :key="i" class="alerta-row" style="pointer-events:none">
                <div class="sk-block" style="height:14px;width:72%;margin-bottom:0.5rem;border-radius:6px"></div>
                <div class="sk-block" style="height:11px;width:88%;margin-bottom:0.6rem;border-radius:6px"></div>
                <div class="sk-block" style="height:20px;width:52px;border-radius:999px"></div>
              </div>
            </div>
          </div>
          <div class="panel-right">
            <div class="sk-block" style="height:20px;width:200px;margin-bottom:0.4rem;border-radius:6px"></div>
            <div class="sk-block" style="height:13px;width:130px;margin-bottom:1.5rem;border-radius:6px"></div>
            <div style="display:flex;flex-direction:column;gap:0.75rem">
              <div v-for="i in 3" :key="i" class="card sk-card">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">
                  <div style="display:flex;gap:0.4rem">
                    <div class="sk-block sk-tag"></div>
                    <div class="sk-block sk-tag"></div>
                  </div>
                  <div class="sk-block sk-badge"></div>
                </div>
                <div class="sk-block sk-title"></div>
                <div class="sk-block sk-line"></div>
                <div style="display:flex;gap:0.75rem;margin-top:0.875rem">
                  <div class="sk-block sk-pill"></div>
                  <div class="sk-block sk-pill"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Sin alertas -->
        <div v-else-if="alertas.length === 0" class="empty-full">
          <div class="empty-icon">🔔</div>
          <p class="empty-title">Aún no tienes alertas</p>
          <p class="empty-desc">Crea tu primera alerta para recibir oportunidades que coincidan con lo que buscas.</p>
          <button class="btn-primary" @click="nuevaAlerta">Crear primera alerta</button>
        </div>

        <!-- Split layout -->
        <div v-else class="split">

          <!-- Panel izquierdo: reglas -->
          <div class="panel-left">
            <div class="panel-header">
              <span class="panel-title">Mis alertas</span>
              <button
                class="btn-new"
                @click="intentarNuevaAlerta"
                :title="canAddAlerta(alertas.length) ? 'Nueva alerta' : `Límite del plan ${label}`"
                :class="{ 'btn-new-locked': !canAddAlerta(alertas.length) }"
              >
                <svg v-if="canAddAlerta(alertas.length)" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </button>
            </div>

            <!-- Preferencias: avisos de cierre próximo -->
            <div class="reminder-prefs">
              <div class="reminder-prefs-title">⏰ Avisarme cuando un fondo cierre en</div>
              <div class="reminder-prefs-opts">
                <label v-for="d in REMINDER_OPTS" :key="d" class="reminder-chip" :class="{ active: reminderDays.includes(d) }">
                  <input type="checkbox" :checked="reminderDays.includes(d)" @change="toggleReminderDay(d)" />
                  {{ d }} {{ d === 1 ? 'día' : 'días' }}
                </label>
              </div>
              <p class="reminder-prefs-hint" v-if="!reminderDays.length">Ningún recordatorio activo.</p>
            </div>

            <!-- Banner límite de plan -->
            <div v-if="hayPausadasPorPlan || !canAddAlerta(alertas.length)" class="plan-limit-banner">
              <div class="plan-limit-text">
                <strong>Plan {{ label }}</strong>
                <span v-if="hayPausadasPorPlan">
                  Máximo {{ maxAlertas === 1 ? '1 alerta activa' : `${maxAlertas} alertas activas` }} · desactiva una para activar otra.
                </span>
                <span v-else>
                  {{ maxAlertas === 1 ? 'Solo 1 alerta' : `Hasta ${maxAlertas} alertas` }} en tu plan actual.
                </span>
              </div>
              <NuxtLink to="/planes" class="plan-limit-cta">Mejorar plan</NuxtLink>
            </div>

            <div class="alertas-nav">
              <div
                v-for="alerta in alertas"
                :key="alerta.id"
                class="alerta-row"
                :class="{ selected: selectedId === alerta.id, inactive: !alerta.activo }"
                @click="selectAlerta(alerta.id)"
              >
                <div class="alerta-row-header">
                  <span class="alerta-name">{{ alerta.nombre || 'Sin nombre' }}</span>
                  <span v-if="unreadCounts[alerta.id] > 0" class="count-badge">
                    {{ unreadCounts[alerta.id] }}
                  </span>
                </div>
                <span class="alerta-summary">{{ resumenAlerta(alerta) }}</span>
                <div class="alerta-row-actions">
                  <button
                    class="pill"
                    :class="{ active: alerta.activo, locked: !alerta.activo && !puedeActivar }"
                    :title="!alerta.activo && !puedeActivar ? `Plan ${label}: desactiva otra alerta primero` : ''"
                    @click.stop="toggleAlerta(alerta)"
                  >
                    {{ alerta.activo ? 'activa' : 'inactiva' }}
                  </button>
                  <button class="icon-btn" @click.stop="editarAlerta(alerta)" title="Editar">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button class="icon-btn danger" @click.stop="borrarAlerta(alerta.id)" title="Eliminar">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Panel derecho: bandeja de notificaciones -->
          <div class="panel-right">
            <Transition name="fade" mode="out-in">
            <template v-if="!selectedId">
              <div class="empty-results">
                <p>Selecciona una alerta para ver su bandeja</p>
              </div>
            </template>
            <template v-else :key="selectedId">
              <div class="results-head">
                <h2 class="results-title">{{ selectedAlerta?.nombre }}</h2>
                <div class="results-meta">
                  <template v-if="loadingResults">
                    <span class="results-count loading">Cargando…</span>
                  </template>
                  <template v-else>
                    <span v-if="unreadNotifications.length > 0" class="results-count">
                      {{ unreadNotifications.length }} nueva{{ unreadNotifications.length !== 1 ? 's' : '' }}
                    </span>
                    <span v-else class="results-count muted">Al día</span>
                    <span v-if="selectedAlerta?.last_notified_at" class="notif-dot">·</span>
                    <span v-if="selectedAlerta?.last_notified_at" class="notif-time">
                      Última notif. {{ timeAgo(selectedAlerta.last_notified_at) }}
                    </span>
                    <span v-else class="notif-time">Sin notificaciones aún</span>
                  </template>
                </div>
                <div v-if="criteriaChips.length" class="chips-row">
                  <span v-for="c in criteriaChips" :key="c" class="filtro-chip">{{ c }}</span>
                </div>
              </div>

              <div v-if="loadingResults" class="empty"><div class="spinner"></div></div>

              <div v-else-if="notifications.length === 0 && liveMatches.length === 0" class="empty-results">
                <div class="empty-icon-wrap">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6.002 6.002 0 0 0-4-5.659V5a2 2 0 1 0-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"/></svg>
                </div>
                <p class="empty-title">Sin oportunidades por ahora</p>
                <p class="empty-desc">Ningún fondo abierto coincide con los filtros de esta alerta. Cuando aparezcan nuevos te avisamos por email y los verás acá.</p>
              </div>

              <!-- Bandeja vacía pero hay fondos abiertos que coinciden con los filtros -->
              <div v-else-if="notifications.length === 0 && liveMatches.length > 0" class="inbox-section">
                <div class="live-banner">
                  <strong>Todavía no recibiste avisos por email para esta alerta.</strong>
                  <span>Mientras tanto, estos son los fondos abiertos que coinciden con tus filtros ahora mismo.</span>
                </div>
                <div class="lista">
                  <div v-for="c in liveMatches" :key="c.id" class="card">
                    <div class="card-top">
                      <div class="card-source">
                        <img :src="`/sources/${c.fuente}.png`" :alt="fuenteLabel(c.fuente)" class="source-logo" @error="(e) => (e.target as HTMLImageElement).style.display='none'" />
                        <div class="tags">
                          <span class="tag-fuente">{{ fuenteLabel(c.fuente) }}</span>
                          <span class="tag-tipo" :class="c.tipo">{{ c.tipo === 'fondo' ? 'Fondo' : 'Licitación' }}</span>
                        </div>
                      </div>
                      <span :class="['badge-estado', c.estado]">{{ estadoLabel(c.estado) }}</span>
                    </div>
                    <NuxtLink :to="`/dashboard/oportunidades/${c.id}`" class="card-title-link">
                      <h3>{{ c.titulo }}</h3>
                    </NuxtLink>
                    <p v-if="c.descripcion_breve" class="desc">{{ c.descripcion_breve }}</p>
                    <div class="card-meta">
                      <span v-if="c.monto_rango" class="meta-item">{{ montoLabel(c.monto_rango) }}</span>
                      <span v-if="c.fecha_cierre_postulacion" class="meta-item" :class="{ urgente: esUrgente(c.fecha_cierre_postulacion) }">
                        Cierra {{ formatFecha(c.fecha_cierre_postulacion) }}
                      </span>
                    </div>
                    <div class="card-footer">
                      <div class="focos">
                        <span v-for="f in (c.foco ?? []).slice(0, 3)" :key="f" class="foco-tag">{{ f }}</span>
                      </div>
                      <div class="card-links">
                        <a v-if="c.link_postulacion" :href="c.link_postulacion" target="_blank" class="ver-link primary">
                          Postular
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                        </a>
                        <NuxtLink :to="`/dashboard/oportunidades/${c.id}`" class="ver-link">Ver detalle</NuxtLink>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <template v-else>
                <!-- Nuevas (no leídas) -->
                <div v-if="unreadNotifications.length > 0" class="inbox-section">
                  <div class="inbox-label">
                    <span class="inbox-label-dot"></span>
                    Nuevas
                  </div>
                  <div class="lista">
                    <div v-for="n in unreadNotifications" :key="n.id" class="card card-nueva">
                      <div class="nueva-chip">Nueva</div>
                      <div class="card-top">
                        <div class="card-source">
                          <img :src="`/sources/${n.conv?.fuente}.png`" :alt="fuenteLabel(n.conv?.fuente)" class="source-logo" @error="(e) => (e.target as HTMLImageElement).style.display='none'" />
                          <div class="tags">
                            <span class="tag-fuente">{{ fuenteLabel(n.conv?.fuente) }}</span>
                            <span class="tag-tipo" :class="n.conv?.tipo">{{ n.conv?.tipo === 'fondo' ? 'Fondo' : 'Licitación' }}</span>
                          </div>
                        </div>
                        <span :class="['badge-estado', n.conv?.estado]">{{ estadoLabel(n.conv?.estado) }}</span>
                      </div>
                      <NuxtLink :to="`/dashboard/oportunidades/${n.convocatoria_id}`" class="card-title-link">
                        <h3>{{ n.conv?.titulo }}</h3>
                      </NuxtLink>
                      <p class="desc">{{ n.conv?.descripcion_breve }}</p>
                      <div class="card-meta">
                        <span v-if="n.conv?.monto_rango" class="meta-item">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                          {{ montoLabel(n.conv?.monto_rango) }}
                        </span>
                        <span v-if="n.conv?.fecha_cierre_postulacion" class="meta-item" :class="{ urgente: esUrgente(n.conv?.fecha_cierre_postulacion) }">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                          Cierra {{ formatFecha(n.conv?.fecha_cierre_postulacion) }}
                        </span>
                        <span class="meta-item meta-notif">Recibido {{ timeAgo(n.notified_at) }}</span>
                      </div>
                      <div class="card-footer">
                        <div class="focos">
                          <span v-for="f in (n.conv?.foco ?? []).slice(0, 3)" :key="f" class="foco-tag">{{ f }}</span>
                        </div>
                        <div class="card-links">
                          <a v-if="n.conv?.link_postulacion" :href="n.conv.link_postulacion" target="_blank" class="ver-link primary">
                            Postular
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                          </a>
                          <NuxtLink :to="`/dashboard/oportunidades/${n.convocatoria_id}`" class="ver-link">Ver detalle</NuxtLink>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Anteriores (leídas) -->
                <div v-if="readNotifications.length > 0" class="inbox-section">
                  <button class="inbox-label inbox-label-toggle" @click="showRead = !showRead">
                    <span>{{ readNotifications.length }} anterior{{ readNotifications.length !== 1 ? 'es' : '' }}</span>
                    <svg :style="{ transform: showRead ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  <div v-if="showRead" class="lista lista-read">
                    <div v-for="n in readNotifications" :key="n.id" class="card card-read">
                      <div class="card-top">
                        <div class="card-source">
                          <img :src="`/sources/${n.conv?.fuente}.png`" :alt="fuenteLabel(n.conv?.fuente)" class="source-logo" @error="(e) => (e.target as HTMLImageElement).style.display='none'" />
                          <div class="tags">
                            <span class="tag-fuente">{{ fuenteLabel(n.conv?.fuente) }}</span>
                            <span class="tag-tipo" :class="n.conv?.tipo">{{ n.conv?.tipo === 'fondo' ? 'Fondo' : 'Licitación' }}</span>
                          </div>
                        </div>
                        <span :class="['badge-estado', n.conv?.estado]">{{ estadoLabel(n.conv?.estado) }}</span>
                      </div>
                      <NuxtLink :to="`/dashboard/oportunidades/${n.convocatoria_id}`" class="card-title-link">
                        <h3>{{ n.conv?.titulo }}</h3>
                      </NuxtLink>
                      <div class="card-meta">
                        <span v-if="n.conv?.monto_rango" class="meta-item">{{ montoLabel(n.conv?.monto_rango) }}</span>
                        <span v-if="n.conv?.fecha_cierre_postulacion" class="meta-item">Cierra {{ formatFecha(n.conv?.fecha_cierre_postulacion) }}</span>
                        <span class="meta-item meta-notif">Recibido {{ timeAgo(n.notified_at) }}</span>
                      </div>
                      <div class="card-footer">
                        <div class="focos">
                          <span v-for="f in (n.conv?.foco ?? []).slice(0, 3)" :key="f" class="foco-tag">{{ f }}</span>
                        </div>
                        <div class="card-links">
                          <a v-if="n.conv?.link_postulacion" :href="n.conv.link_postulacion" target="_blank" class="ver-link primary">
                            Postular <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                          </a>
                          <NuxtLink :to="`/dashboard/oportunidades/${n.convocatoria_id}`" class="ver-link">Ver detalle</NuxtLink>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </template>
            </Transition>
          </div>
        </div>
      </template>

    </div>
  </NuxtLayout>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: false })

const supabase  = useSupabaseClient()

// ── Plan ──────────────────────────────────────────────────────────
const { plan, label, canAddAlerta, maxAlertas, load: loadPlan } = usePlan()
const { show: toast } = useToast()

// ── Constantes ───────────────────────────────────────────────────
const FUENTES = [
  { value: 'corfo',          label: 'CORFO' },
  { value: 'sercotec',       label: 'SERCOTEC' },
  { value: 'anid',           label: 'ANID' },
  { value: 'mercadopublico', label: 'Mercado Público' },
  { value: 'fondos_gob',     label: 'Fondos.gob.cl' },
  { value: 'incubadoras',    label: 'Incubadoras' },
  { value: 'fondos_cultura', label: 'Fondos Cultura' },
]
const ALCANCES = [
  { value: 'regional',      label: 'Regional' },
  { value: 'nacional',      label: 'Nacional' },
  { value: 'internacional', label: 'Internacional' },
]
const FOCOS = [
  'Agroindustrias', 'Banca y Fintech', 'Climatech', 'Descarbonización',
  'Digitalización', 'Educación', 'Economía Verde', 'I+D+i',
  'Industrial', 'Innovación Social', 'Mujeres', 'Multisectorial',
  'Recursos Forestales', 'Recursos Hídricos', 'Tech',
]
const MONTOS = [
  { value: 'hasta_1M',   label: 'Hasta $1M' },
  { value: '1M_10M',     label: '$1M – $10M' },
  { value: '10M_30M',    label: '$10M – $30M' },
  { value: '30M_60M',    label: '$30M – $60M' },
  { value: '60M_100M',   label: '$60M – $100M' },
  { value: 'sobre_100M', label: 'Más de $100M' },
]
const MONTO_ORDER = MONTOS.map(m => m.value)

// ── Estado ───────────────────────────────────────────────────────
const view    = ref<'list' | 'form'>('list')
const loading = ref(true)

const alertas    = ref<any[]>([])
const selectedId = ref<string | null>(null)

// Preferencias de recordatorios de cierre (closing_reminder_days)
const REMINDER_OPTS = [7, 3, 1]
const reminderDays = ref<number[]>([3])
async function toggleReminderDay(d: number) {
  const next = reminderDays.value.includes(d)
    ? reminderDays.value.filter(x => x !== d)
    : [...reminderDays.value, d].sort((a, b) => b - a)
  reminderDays.value = next
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('profiles')
    .update({ closing_reminder_days: next } as any)
    .eq('id', user.id)
}

const loadingResults = ref(false)
const notifications  = ref<any[]>([])
const liveMatches    = ref<any[]>([])
const unreadCounts   = ref<Record<string, number>>({})
const showRead       = ref(false)

const idsPostulados  = ref<string[]>([])
const showAvanzados  = ref(false)

// Form
const editingAlerta = ref<any>(null)
const guardando     = ref(false)
const formMsg       = ref('')
const formError     = ref(false)
const tagInput      = ref('')

const form = ref({
  nombre:          '',
  tipos:           [] as string[],
  fuentes:         [] as string[],
  alcance_interes: [] as string[],
  monto_minimo:    '',
  monto_rangos:    [] as string[],
  foco:            [] as string[],
  palabras_clave:  [] as string[],
})

// ── Computed ─────────────────────────────────────────────────────
const selectedAlerta   = computed(() => alertas.value.find(a => a.id === selectedId.value) ?? null)
const alertasActivas   = computed(() => alertas.value.filter(a => a.activo))
const puedeActivar     = computed(() => maxAlertas.value === -1 || alertasActivas.value.length < maxAlertas.value)
const hayPausadasPorPlan = computed(() => maxAlertas.value !== -1 && alertas.value.length > maxAlertas.value)

const unreadNotifications = computed(() => notifications.value.filter(n => !n.is_read))
const readNotifications   = computed(() => notifications.value.filter(n => n.is_read))

const criteriaChips = computed(() => {
  const a = selectedAlerta.value
  if (!a) return []
  const chips: string[] = []
  for (const f of (a.foco ?? []).slice(0, 3)) chips.push(f)
  for (const k of (a.palabras_clave ?? []).slice(0, 2)) chips.push(`"${k}"`)
  if (a.tipos?.includes('fondo')) chips.push('Fondos')
  if (a.tipos?.includes('licitacion')) chips.push('Licitaciones')
  for (const f of (a.fuentes ?? [])) chips.push(fuenteLabel(f))
  for (const al of (a.alcance_interes ?? [])) chips.push(al === 'regional' ? 'Regional' : al === 'nacional' ? 'Nacional' : 'Internacional')
  if (a.monto_minimo) chips.push(`Desde ${montoLabel(a.monto_minimo)}`)
  return chips
})

// ── Lifecycle ────────────────────────────────────────────────────
onMounted(async () => {
  const { data: { user } } = await supabase.auth.getUser()

  await loadPlan()

  const [{ data: alertasData }, { data: postulacionesData }, { data: profileData }] = await Promise.all([
    supabase.from('alert_configs').select('*').eq('user_id', user!.id).order('created_at', { ascending: true }),
    supabase.from('postulaciones').select('convocatoria_id'),
    supabase.from('profiles').select('closing_reminder_days').eq('id', user!.id).maybeSingle(),
  ])

  alertas.value       = alertasData ?? []
  idsPostulados.value = (postulacionesData ?? []).map(p => p.convocatoria_id)
  const rem = (profileData as any)?.closing_reminder_days
  if (Array.isArray(rem)) reminderDays.value = rem.slice().sort((a: number, b: number) => b - a)

  loadUnreadCounts()

  // Auto-pausar solo si el plan tiene límite real (nunca para advanced/agency)
  const limite = maxAlertas.value
  if (limite !== -1 && limite > 0) {
    const activos = alertas.value.filter(a => a.activo)
    if (activos.length > limite) {
      const aPausar = activos.slice(limite)
      await Promise.all(aPausar.map(a =>
        supabase.from('alert_configs').update({ activo: false }).eq('id', a.id)
      ))
      aPausar.forEach(a => { a.activo = false })
    }
  }

  loading.value    = false

  const primera = alertas.value.find(a => a.activo)
  if (primera) selectAlerta(primera.id)
})

// ── Alert CRUD ───────────────────────────────────────────────────
function intentarNuevaAlerta() {
  if (!canAddAlerta(alertas.value.length)) return
  nuevaAlerta()
}

function nuevaAlerta() {
  editingAlerta.value = null
  form.value = { nombre: '', tipos: [], fuentes: [], alcance_interes: [], monto_minimo: '', monto_rangos: [], foco: [], palabras_clave: [] }
  tagInput.value    = ''
  formMsg.value     = ''
  showAvanzados.value = false
  view.value        = 'form'
}

function editarAlerta(alerta: any) {
  editingAlerta.value = alerta
  form.value = {
    nombre:          alerta.nombre ?? '',
    tipos:           [...(alerta.tipos ?? [])],
    fuentes:         [...(alerta.fuentes ?? [])],
    alcance_interes: [...(alerta.alcance_interes ?? [])],
    monto_minimo:    alerta.monto_minimo ?? '',
    monto_rangos:    [...(alerta.monto_rangos ?? [])],
    foco:            [...(alerta.foco ?? [])],
    palabras_clave:  [...(alerta.palabras_clave ?? [])],
  }
  tagInput.value      = ''
  formMsg.value       = ''
  showAvanzados.value = !!(alerta.foco?.length || alerta.palabras_clave?.length)
  view.value          = 'form'
}

function cancelarForm() {
  view.value = 'list'
  editingAlerta.value = null
}

async function guardarAlerta() {
  if (!form.value.nombre.trim()) return
  guardando.value = true
  formMsg.value   = ''

  const { data: { user } } = await supabase.auth.getUser()
  const payload = {
    user_id:         user!.id,
    nombre:          form.value.nombre.trim(),
    tipos:           form.value.tipos,
    fuentes:         form.value.fuentes,
    alcance_interes: form.value.alcance_interes,
    monto_minimo:    form.value.monto_minimo || null,
    monto_rangos:    form.value.monto_rangos,
    foco:            form.value.foco,
    palabras_clave:  form.value.palabras_clave,
    activo:          editingAlerta.value ? editingAlerta.value.activo : true,
    updated_at:      new Date().toISOString(),
  }

  let err: any = null
  if (editingAlerta.value) {
    const { error } = await supabase.from('alert_configs').update(payload).eq('id', editingAlerta.value.id)
    err = error
    if (!error) {
      const idx = alertas.value.findIndex(a => a.id === editingAlerta.value!.id)
      if (idx >= 0) alertas.value[idx] = { ...alertas.value[idx], ...payload }
    }
  } else {
    const { data, error } = await supabase.from('alert_configs').insert(payload).select().single()
    err = error
    if (!error && data) {
      alertas.value.push(data)
      selectAlerta(data.id)
    }
  }

  formError.value = !!err
  if (err) {
    formMsg.value = 'Error al guardar.'
  } else {
    view.value = 'list'
    toast(editingAlerta.value ? 'Alerta actualizada' : 'Alerta creada')
    if (editingAlerta.value) {
      if (selectedId.value === editingAlerta.value.id) await loadNotifications()
    }
  }
  guardando.value = false
}

async function borrarAlerta(id: string) {
  if (!confirm('¿Eliminar esta alerta?')) return
  await supabase.from('alert_configs').delete().eq('id', id)
  alertas.value = alertas.value.filter(a => a.id !== id)
  toast('Alerta eliminada', 'info')
  if (selectedId.value === id) {
    selectedId.value = null
    notifications.value = []
    const otra = alertas.value.find(a => a.activo)
    if (otra) selectAlerta(otra.id)
  }
}

async function toggleAlerta(alerta: any) {
  const nuevoEstado = !alerta.activo
  if (nuevoEstado && !puedeActivar.value) return
  await supabase.from('alert_configs').update({ activo: nuevoEstado }).eq('id', alerta.id)
  alerta.activo = nuevoEstado
}

// ── Selección y bandeja ──────────────────────────────────────────
async function selectAlerta(id: string) {
  if (selectedId.value === id) return
  selectedId.value = id
  notifications.value = []
  liveMatches.value = []
  showRead.value = false
  await loadNotifications()
  await markRead()
}

async function loadNotifications() {
  const alerta = selectedAlerta.value
  if (!alerta) return
  loadingResults.value = true

  const { data: notifs } = await supabase
    .from('alert_notifications')
    .select('id, convocatoria_id, is_read, notified_at')
    .eq('alert_config_id', alerta.id)
    .order('is_read', { ascending: true })
    .order('notified_at', { ascending: false })
    .limit(100)

  if (!notifs?.length) {
    notifications.value = []
    await loadLiveMatches()
    loadingResults.value = false
    return
  }

  const ids = notifs.map(n => n.convocatoria_id)
  const { data: convs } = await supabase
    .from('convocatorias')
    .select('id, titulo, descripcion_breve, fuente, tipo, estado, monto_rango, fecha_cierre_postulacion, link_postulacion, foco')
    .in('id', ids)

  const convMap = Object.fromEntries((convs ?? []).map(c => [c.id, c]))
  notifications.value = notifs.map(n => ({ ...n, conv: convMap[n.convocatoria_id] ?? null }))
  loadingResults.value = false
}

// Cuando la bandeja está vacía, mostramos los matches actuales en base a los
// filtros de la alerta. Útil para alertas recién creadas (el cron solo mira las
// últimas 25h) o cuando no hay novedades hace tiempo. Replica la query del
// worker pero sin el filtro `created_at > desde`.
async function loadLiveMatches() {
  const alerta = selectedAlerta.value
  if (!alerta) return

  let q = supabase
    .from('convocatorias')
    .select('id, titulo, descripcion_breve, fuente, tipo, estado, monto_rango, fecha_cierre_postulacion, link_postulacion, foco')
    .eq('estado', 'abierto')
    .order('fecha_cierre_postulacion', { ascending: true, nullsFirst: false })
    .limit(20)

  if (alerta.tipos?.length)           q = q.in('tipo',    alerta.tipos)
  if (alerta.fuentes?.length)         q = q.in('fuente',  alerta.fuentes)
  if (alerta.alcance_interes?.length) q = q.in('alcance', alerta.alcance_interes)

  if (alerta.monto_rangos?.length) {
    q = q.in('monto_rango', alerta.monto_rangos)
  } else if (alerta.monto_minimo) {
    const idx = MONTO_ORDER.indexOf(alerta.monto_minimo)
    if (idx >= 0) q = q.in('monto_rango', MONTO_ORDER.slice(idx))
  }

  if (alerta.foco?.length) q = q.contains('foco', alerta.foco)

  if (alerta.palabras_clave?.length) {
    const orStr = alerta.palabras_clave.flatMap((k: string) => [
      `titulo.ilike.*${k}*`,
      `descripcion_breve.ilike.*${k}*`,
    ]).join(',')
    q = q.or(orStr)
  }

  if (idsPostulados.value.length) {
    q = q.not('id', 'in', `(${idsPostulados.value.join(',')})`)
  }

  const { data } = await q
  const hoy = new Date().toISOString().split('T')[0]
  liveMatches.value = (data ?? []).filter(c =>
    !c.fecha_cierre_postulacion || c.fecha_cierre_postulacion >= hoy
  )
}

async function markRead() {
  const alerta = selectedAlerta.value
  if (!alerta) return
  const unread = notifications.value.filter(n => !n.is_read)
  if (!unread.length) return

  await supabase
    .from('alert_notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('alert_config_id', alerta.id)
    .eq('is_read', false)

  notifications.value = notifications.value.map(n => ({ ...n, is_read: true }))
  unreadCounts.value = { ...unreadCounts.value, [alerta.id]: 0 }
}

async function loadUnreadCounts() {
  const entries = await Promise.all(
    alertas.value.map(async a => {
      const { count } = await supabase
        .from('alert_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('alert_config_id', a.id)
        .eq('is_read', false)
      return [a.id, count ?? 0] as const
    })
  )
  unreadCounts.value = Object.fromEntries(entries)
}

function addTag() {
  const val = tagInput.value.trim().replace(',', '')
  if (val && !form.value.palabras_clave.includes(val))
    form.value.palabras_clave.push(val)
  tagInput.value = ''
}
function removeTag(i: number) {
  form.value.palabras_clave.splice(i, 1)
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000)        return 'hace un momento'
  if (diff < 3_600_000)     return `hace ${Math.floor(diff / 60_000)} min`
  const h = Math.floor(diff / 3_600_000)
  if (h < 24)               return `hace ${h}h`
  if (h < 48)               return 'ayer'
  return `hace ${Math.floor(h / 24)} días`
}

function resumenAlerta(a: any): string {
  const parts: string[] = []
  if (a.foco?.length)            parts.push(a.foco.slice(0, 2).join(', '))
  if (a.fuentes?.length)         parts.push(a.fuentes.map(fuenteLabel).join(', '))
  if (a.tipos?.includes('fondo'))      parts.push('Fondos')
  if (a.tipos?.includes('licitacion')) parts.push('Licitaciones')
  if (a.alcance_interes?.length) parts.push(a.alcance_interes[0])
  if (a.monto_minimo)            parts.push(`Desde ${montoLabel(a.monto_minimo)}`)
  return parts.length ? parts.join(' · ') : 'Todas las fuentes'
}

// ── Label helpers ────────────────────────────────────────────────
function fuenteLabel(f: string) {
  return { corfo: 'CORFO', sercotec: 'SERCOTEC', anid: 'ANID', mercadopublico: 'Mercado Público', fondos_gob: 'Fondos.gob.cl', incubadoras: 'Incubadoras', fondos_cultura: 'Fondos Cultura' }[f] ?? f
}
function estadoLabel(e: string) {
  return { abierto: 'Abierto', cerrado: 'Cerrado', por_abrir: 'Por abrir' }[e] ?? e
}
function montoLabel(m: string) {
  return { hasta_1M: 'Hasta $1M', '1M_10M': '$1M – $10M', '10M_30M': '$10M – $30M', '30M_60M': '$30M – $60M', '60M_100M': '$60M – $100M', sobre_100M: 'Más de $100M' }[m] ?? m
}
function esUrgente(f: string) {
  const dias = (new Date(f).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  return dias >= 0 && dias <= 7
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.content { flex: 1; padding: 2rem 2.5rem; font-family: 'Inter', sans-serif; height: 100%; }

/* Plan limit banner */
.plan-limit-banner {
  display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
  padding: 0.75rem 1.25rem; background: #fefce8; border-bottom: 1px solid #fde68a;
  flex-shrink: 0;
}
.plan-limit-text { display: flex; flex-direction: column; gap: 0.1rem; }
.plan-limit-text strong { font-size: 0.8rem; font-weight: 700; color: #92400e; }
.plan-limit-text span  { font-size: 0.75rem; color: #a16207; }
.plan-limit-cta {
  font-size: 0.75rem; font-weight: 700; color: white; background: #f59e0b;
  padding: 0.3rem 0.75rem; border-radius: 7px; text-decoration: none; white-space: nowrap;
  transition: background 0.15s; flex-shrink: 0;
}
.plan-limit-cta:hover { background: #d97706; }
.btn-new-locked { background: #94a3b8 !important; cursor: not-allowed; }

/* ── Form view ──────────────────────────────────────────────────── */
.form-info {
  display: flex; align-items: center; gap: 0.5rem;
  font-size: 0.8125rem; color: #0369a1; background: #f0f9ff;
  border: 1px solid #bae6fd; border-radius: 9px; padding: 0.625rem 0.875rem;
  margin-bottom: 1.25rem;
}
.form-info a { color: #0ea5e9; font-weight: 600; text-decoration: none; margin-left: 0.25rem; }
.form-info a:hover { text-decoration: underline; }

.form-page { max-width: 680px; }
.back-btn {
  display: inline-flex; align-items: center; gap: 0.4rem;
  font-size: 0.8125rem; font-weight: 500; color: #64748b;
  background: none; border: none; cursor: pointer; padding: 0; margin-bottom: 1.25rem;
  transition: color 0.15s; font-family: inherit;
}
.back-btn:hover { color: #0f172a; }
.form-page h1 { font-size: 1.375rem; font-weight: 700; color: #0f172a; letter-spacing: -0.02em; }
.form-desc { font-size: 0.875rem; color: #64748b; margin-top: 0.25rem; margin-bottom: 1.75rem; }

.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.full-width { grid-column: 1 / -1; }
.card { background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1.25rem 1.5rem; }
.card-header { margin-bottom: 1rem; }
.card-header h2 { font-size: 0.875rem; font-weight: 700; color: #0f172a; margin-bottom: 0.15rem; }
.hint { font-size: 0.75rem; color: #94a3b8; }

.text-input {
  width: 100%; padding: 0.65rem 0.875rem; border: 1.5px solid #e2e8f0;
  border-radius: 9px; font-size: 0.9375rem; font-family: inherit; outline: none;
  transition: border-color 0.15s, box-shadow 0.15s; color: #0f172a;
}
.text-input:focus { border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(14,165,233,0.1); }

.checks { display: flex; flex-direction: column; gap: 0.5rem; }
.checks-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; }
.check-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; color: #374151; cursor: pointer; user-select: none; }
.check-item input[type="checkbox"] { display: none; }
.check-box { width: 16px; height: 16px; border: 1.5px solid #cbd5e1; border-radius: 4px; flex-shrink: 0; transition: all 0.15s; position: relative; background: white; }
.check-item input:checked + .check-box { background: #0ea5e9; border-color: #0ea5e9; }
.check-item input:checked + .check-box::after { content: ''; position: absolute; left: 3px; top: 1px; width: 6px; height: 9px; border: 2px solid white; border-top: none; border-left: none; transform: rotate(45deg); }

.tags-input { display: flex; flex-wrap: wrap; gap: 0.4rem; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 0.5rem; background: #fafafa; transition: all 0.15s; }
.tags-input:focus-within { border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(14,165,233,0.1); background: white; }
.tags-input input { border: none; background: transparent; padding: 0.15rem 0.2rem; flex: 1; min-width: 100px; font-size: 0.875rem; font-family: inherit; outline: none; color: #0f172a; }
.tag { display: flex; align-items: center; gap: 0.25rem; background: #e0f2fe; color: #0284c7; font-size: 0.775rem; font-weight: 600; padding: 0.15rem 0.45rem 0.15rem 0.6rem; border-radius: 999px; }
.tag button { background: none; border: none; color: #7dd3fc; cursor: pointer; font-size: 1rem; padding: 0; line-height: 1; transition: color 0.15s; }
.tag button:hover { color: #0284c7; }

.select-input {
  width: 100%; padding: 0.6rem 0.75rem; border: 1.5px solid #e2e8f0; border-radius: 9px;
  font-size: 0.875rem; font-family: inherit; outline: none; background: white; color: #0f172a;
  cursor: pointer; appearance: none; transition: border-color 0.15s;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 0.75rem center; padding-right: 2.25rem;
}
.select-input:focus { border-color: #0ea5e9; box-shadow: 0 0 0 3px rgba(14,165,233,0.1); }

.basicos-label {
  display: flex; align-items: center; gap: 0.5rem;
  font-size: 0.875rem; font-weight: 600; color: #475569;
  border: 1.5px dashed #e2e8f0; border-radius: 10px;
  padding: 0.6rem 1rem;
}

.avanzados-wrap { }
.avanzados-toggle {
  display: flex; align-items: center; gap: 0.5rem;
  font-size: 0.875rem; font-weight: 600; color: #475569;
  background: none; border: 1.5px dashed #e2e8f0; border-radius: 10px;
  padding: 0.6rem 1rem; cursor: pointer; width: 100%;
  font-family: inherit; transition: border-color 0.15s, color 0.15s;
}
.avanzados-toggle:hover { border-color: #0ea5e9; color: #0ea5e9; }
.avanzados-badge {
  font-size: 0.65rem; font-weight: 700; background: #0ea5e9; color: white;
  padding: 0.1rem 0.45rem; border-radius: 999px;
}
.avanzados-toggle svg { margin-left: auto; }
.avanzados-content { display: flex; flex-direction: column; gap: 1rem; margin-top: 0.75rem; }

.form-actions { display: flex; align-items: center; gap: 0.75rem; margin-top: 1.5rem; }
.btn-save {
  padding: 0.65rem 1.5rem; background: #0ea5e9; color: white; font-size: 0.9rem;
  font-weight: 600; font-family: inherit; border: none; border-radius: 10px;
  cursor: pointer; transition: background 0.15s; display: flex; align-items: center; gap: 0.4rem;
}
.btn-save:hover:not(:disabled) { background: #0284c7; }
.btn-save:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-cancel { padding: 0.65rem 1.25rem; background: white; border: 1.5px solid #e2e8f0; color: #64748b; font-size: 0.9rem; font-weight: 500; font-family: inherit; border-radius: 10px; cursor: pointer; transition: all 0.15s; }
.btn-cancel:hover { border-color: #cbd5e1; color: #475569; }
.mensaje { font-size: 0.875rem; font-weight: 500; padding: 0.5rem 0.875rem; border-radius: 8px; }
.mensaje.ok    { background: #f0fdf4; color: #16a34a; }
.mensaje.error { background: #fef2f2; color: #dc2626; }
.spinner-btn { width: 13px; height: 13px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.65s linear infinite; }

/* ── List view ──────────────────────────────────────────────────── */
.split { display: grid; grid-template-columns: 260px 1fr; gap: 0; height: calc(100vh - 4rem); }

.panel-left {
  border-right: 1px solid #e2e8f0; display: flex; flex-direction: column;
  overflow-y: auto; background: white;
}
.panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.25rem; border-bottom: 1px solid #f1f5f9; flex-shrink: 0;
}
.panel-title { font-size: 0.8125rem; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.06em; }

.reminder-prefs {
  background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;
  padding: 0.75rem 0.875rem; margin-bottom: 0.75rem;
}
.reminder-prefs-title { font-size: 0.72rem; font-weight: 700; color: #475569; margin-bottom: 0.5rem; }
.reminder-prefs-opts  { display: flex; gap: 0.375rem; flex-wrap: wrap; }
.reminder-chip {
  display: inline-flex; align-items: center; gap: 0.3rem;
  padding: 0.25rem 0.6rem; border-radius: 999px;
  background: white; border: 1px solid #e2e8f0; color: #64748b;
  font-size: 0.75rem; font-weight: 600; cursor: pointer;
  transition: all 0.15s; user-select: none;
}
.reminder-chip:hover  { border-color: #cbd5e1; }
.reminder-chip.active { background: #f0f9ff; border-color: #bae6fd; color: #0ea5e9; }
.reminder-chip input  { display: none; }
.reminder-prefs-hint { font-size: 0.72rem; color: #f59e0b; margin-top: 0.4rem; font-weight: 500; }
.btn-new {
  width: 26px; height: 26px; background: #0ea5e9; color: white; border: none;
  border-radius: 7px; cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: background 0.15s;
}
.btn-new:hover { background: #0284c7; }

.alertas-nav { display: flex; flex-direction: column; flex: 1; overflow-y: auto; }

.alerta-row {
  padding: 0.875rem 1.25rem; cursor: pointer; border-bottom: 1px solid #f8fafc;
  transition: background 0.1s;
}
.alerta-row:hover { background: #f8fafc; }
.alerta-row.selected { background: #f0f9ff; border-left: 3px solid #0ea5e9; padding-left: calc(1.25rem - 3px); }
.alerta-row.inactive { opacity: 0.5; }

.alerta-row-header { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.2rem; }
.alerta-name { font-size: 0.875rem; font-weight: 600; color: #0f172a; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.count-badge { flex-shrink: 0; font-size: 0.65rem; font-weight: 700; background: #e0f2fe; color: #0284c7; padding: 0.1rem 0.45rem; border-radius: 999px; }
.alerta-summary { font-size: 0.75rem; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; margin-bottom: 0.5rem; }

.alerta-row-actions { display: flex; align-items: center; gap: 0.4rem; opacity: 0; transition: opacity 0.15s; }
.alerta-row:hover .alerta-row-actions,
.alerta-row.selected .alerta-row-actions { opacity: 1; }
.pill {
  font-size: 0.65rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 999px;
  background: #f1f5f9; color: #94a3b8; border: none; cursor: pointer; transition: all 0.15s;
  font-family: inherit; text-transform: uppercase; letter-spacing: 0.04em;
}
.pill.active { background: #f0fdf4; color: #16a34a; }
.pill.locked { opacity: 0.45; cursor: not-allowed; }
.icon-btn {
  width: 24px; height: 24px; background: none; border: none; cursor: pointer;
  color: #94a3b8; border-radius: 5px; display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.icon-btn:hover { background: #f1f5f9; color: #475569; }
.icon-btn.danger:hover { background: #fef2f2; color: #ef4444; }

.panel-right { overflow-y: auto; padding: 1.75rem 2rem; }

.results-head { margin-bottom: 1.5rem; }
.results-title { font-size: 1.375rem; font-weight: 800; color: #0f172a; letter-spacing: -0.025em; margin-bottom: 0.35rem; }
.results-meta { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
.results-count { font-size: 0.875rem; font-weight: 600; color: #0f172a; }
.results-count.loading { color: #94a3b8; }
.notif-dot { color: #cbd5e1; font-size: 0.875rem; }
.notif-time { font-size: 0.8125rem; color: #94a3b8; }
.chips-row { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.75rem; }
.filtro-chip { font-size: 0.72rem; font-weight: 600; padding: 0.2rem 0.6rem; background: #f0f9ff; border: 1px solid #bae6fd; color: #0369a1; border-radius: 999px; }

/* Empty states */
.empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 5rem 2rem; text-align: center; gap: 0.75rem; }
.empty-full { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; text-align: center; gap: 0.75rem; }
.empty-results { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 40vh; text-align: center; gap: 0.5rem; color: #94a3b8; font-size: 0.9rem; }
.empty-icon { font-size: 2.5rem; }
.empty-icon-wrap { width: 52px; height: 52px; background: #f1f5f9; border-radius: 14px; display: flex; align-items: center; justify-content: center; }
.empty-title { font-size: 1rem; font-weight: 600; color: #0f172a; }
.empty-desc { font-size: 0.875rem; color: #64748b; max-width: 360px; line-height: 1.6; }
.btn-primary { margin-top: 0.5rem; padding: 0.625rem 1.25rem; background: #0ea5e9; color: white; font-size: 0.9rem; font-weight: 600; border-radius: 10px; border: none; cursor: pointer; transition: background 0.15s; font-family: inherit; }
.btn-primary:hover { background: #0284c7; }

/* Result cards */
.lista { display: flex; flex-direction: column; gap: 0.75rem; }
.card.nueva { border-left: 3px solid #0ea5e9; }
.nueva-chip { position: absolute; top: 1rem; right: 1rem; font-size: 0.6rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; background: #0ea5e9; color: white; padding: 0.15rem 0.45rem; border-radius: 999px; }
.card { background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 1.25rem 1.5rem; position: relative; transition: box-shadow 0.15s, border-color 0.15s; }
.card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.06); border-color: #cbd5e1; }

.card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.625rem; gap: 0.5rem; }
.card-source { display: flex; align-items: center; gap: 0.625rem; }
.source-logo { width: 36px; height: 36px; border-radius: 8px; object-fit: cover; flex-shrink: 0; }
.tags { display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center; }
.tag-fuente { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #0ea5e9; }
.tag-tipo { font-size: 0.68rem; font-weight: 600; padding: 0.12rem 0.45rem; border-radius: 999px; }
.tag-tipo.fondo { background: #f0fdf4; color: #16a34a; }
.tag-tipo.licitacion { background: #eef2ff; color: #4338ca; }
.badge-estado { font-size: 0.68rem; font-weight: 700; padding: 0.18rem 0.55rem; border-radius: 999px; letter-spacing: 0.03em; text-transform: uppercase; white-space: nowrap; }
.badge-estado.abierto   { background: #f0fdf4; color: #16a34a; }
.badge-estado.cerrado   { background: #f1f5f9; color: #94a3b8; }
.badge-estado.por_abrir { background: #fefce8; color: #a16207; }

.card-title-link { text-decoration: none; }
.card-title-link:hover h3 { color: #0ea5e9; }
.card h3 { font-size: 0.9375rem; font-weight: 600; color: #0f172a; margin-bottom: 0.375rem; line-height: 1.4; transition: color 0.15s; }
.desc { font-size: 0.875rem; color: #64748b; line-height: 1.55; }

.card-meta { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 0.875rem; }
.meta-item { display: flex; align-items: center; gap: 0.3rem; font-size: 0.78rem; color: #94a3b8; font-weight: 500; }
.meta-item.urgente { color: #f59e0b; font-weight: 600; }

.card-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; padding-top: 0.875rem; border-top: 1px solid #f1f5f9; gap: 0.75rem; flex-wrap: wrap; }
.focos { display: flex; gap: 0.3rem; flex-wrap: wrap; }
.foco-tag { font-size: 0.68rem; font-weight: 500; padding: 0.18rem 0.45rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 5px; color: #64748b; }
.card-links { display: flex; gap: 0.75rem; align-items: center; }
.ver-link { display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.8rem; font-weight: 600; color: #94a3b8; text-decoration: none; transition: color 0.15s; }
.ver-link:hover { color: #64748b; }
.ver-link.primary { color: #0ea5e9; background: #f0f9ff; padding: 0.3rem 0.7rem; border-radius: 7px; border: 1px solid #bae6fd; }
.ver-link.primary:hover { background: #e0f2fe; }

.load-more { text-align: center; margin-top: 1.5rem; }
.btn-more { padding: 0.6rem 1.5rem; background: white; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 0.875rem; font-weight: 500; font-family: inherit; color: #475569; cursor: pointer; transition: all 0.15s; }
.btn-more:hover { border-color: #0ea5e9; color: #0ea5e9; }
.btn-more:disabled { opacity: 0.5; cursor: not-allowed; }

.spinner { width: 28px; height: 28px; border: 3px solid #e2e8f0; border-top-color: #0ea5e9; border-radius: 50%; animation: spin 0.65s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

@keyframes shimmer { from { background-position: -600px 0; } to { background-position: 600px 0; } }
.sk-card { pointer-events: none; }
.sk-block { background: linear-gradient(90deg, #f1f5f9 25%, #e8edf3 50%, #f1f5f9 75%); background-size: 1200px 100%; animation: shimmer 1.5s infinite; border-radius: 6px; }
.sk-tag { width: 58px; height: 14px; }
.sk-badge { width: 52px; height: 20px; border-radius: 999px; }
.sk-title { height: 18px; width: 70%; margin-bottom: 0.6rem; }
.sk-line { height: 13px; }
.sk-pill { width: 80px; height: 13px; border-radius: 999px; }

/* ── Inbox ───────────────────────────────────────────────────── */
.results-count.muted { color: #94a3b8; }

.inbox-section { margin-bottom: 1.5rem; }

.live-banner {
  display: flex; flex-direction: column; gap: 0.2rem;
  background: #fffbeb; border: 1px solid #fde68a;
  border-radius: 10px; padding: 0.75rem 1rem; margin-bottom: 1rem;
}
.live-banner strong { font-size: 0.85rem; font-weight: 700; color: #92400e; }
.live-banner span { font-size: 0.78rem; color: #b45309; line-height: 1.45; }

.inbox-label {
  display: flex; align-items: center; gap: 0.5rem;
  font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.07em; color: #64748b;
  padding: 0.25rem 0; margin-bottom: 0.75rem;
}
.inbox-label-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: #0ea5e9; box-shadow: 0 0 6px #0ea5e9;
}
.inbox-label-toggle {
  background: none; border: none; cursor: pointer;
  font-family: inherit; justify-content: space-between;
  width: 100%; padding: 0.5rem 0;
  border-top: 1px solid #f1f5f9;
  transition: color 0.15s;
}
.inbox-label-toggle:hover { color: #0f172a; }

.card-nueva {
  border-left: 3px solid #0ea5e9;
}
.card-read {
  opacity: 0.7;
}
.card-read:hover { opacity: 1; }

.lista-read { margin-top: 0.5rem; }

.meta-notif { color: #94a3b8 !important; font-style: italic; }

@media (max-width: 900px) {
  .split { grid-template-columns: 1fr; height: auto; }
  .panel-left { border-right: none; border-bottom: 1px solid #e2e8f0; max-height: 280px; }
  .form-grid { grid-template-columns: 1fr; }
  .content { padding: 1.5rem 1rem; }
}
</style>
