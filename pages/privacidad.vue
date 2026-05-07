<template>
  <div class="page">
    <div class="container">
      <NuxtLink to="/" class="back">← Volver</NuxtLink>
      <h1>Política de Privacidad</h1>
      <p class="updated">Última actualización: mayo de 2026</p>

      <section>
        <h2>1. Responsable del tratamiento</h2>
        <p><strong>[Razón social, RUT, dirección]</strong>. Contacto: <a href="mailto:contacto@fondosylicitaciones.cl">contacto@fondosylicitaciones.cl</a>.</p>
      </section>

      <section>
        <h2>2. Qué datos recolectamos</h2>
        <ul>
          <li><strong>Datos de cuenta:</strong> correo electrónico y contraseña (almacenada de forma cifrada por nuestro proveedor de autenticación, Supabase).</li>
          <li><strong>Datos de perfil:</strong> nombre, empresa, RUT (opcionales), tipo de persona, etapa del proyecto, focos de interés, palabras clave, alcance geográfico y rango de monto. Estos datos los proporciona voluntariamente el usuario para mejorar la calidad de las recomendaciones.</li>
          <li><strong>Datos de uso:</strong> oportunidades guardadas, postulaciones registradas, notificaciones leídas, alertas configuradas.</li>
          <li><strong>Datos técnicos:</strong> dirección IP, tipo de navegador, fecha y hora de acceso, recolectados por servicios de analítica (Google Analytics y Microsoft Clarity).</li>
        </ul>
      </section>

      <section>
        <h2>3. Para qué usamos tus datos</h2>
        <ul>
          <li>Operar el Servicio: autenticación, personalización de alertas, cálculo de match.</li>
          <li>Enviarte por email digests diarios de oportunidades y notificaciones operativas (cambios de cuenta, recuperación de contraseña).</li>
          <li>Mejorar el Servicio mediante análisis estadístico agregado.</li>
        </ul>
      </section>

      <section>
        <h2>4. Con quién compartimos tus datos</h2>
        <ul>
          <li><strong>Supabase</strong> (almacenamiento de base de datos y autenticación).</li>
          <li><strong>Resend</strong> (envío de emails).</li>
          <li><strong>Cloudflare</strong> (procesamiento del envío de digests).</li>
          <li><strong>Google Analytics</strong> y <strong>Microsoft Clarity</strong> (analítica de uso).</li>
          <li><strong>MercadoPago</strong> (cuando se contraten planes pagos, para el procesamiento de pagos).</li>
        </ul>
        <p>No vendemos ni cedemos tus datos a terceros con fines comerciales.</p>
      </section>

      <section>
        <h2>5. Cookies</h2>
        <p>Utilizamos cookies propias (sesión de autenticación) y de terceros (Google Analytics, Microsoft Clarity) para análisis de uso. Puedes desactivar las cookies desde tu navegador.</p>
      </section>

      <section>
        <h2>6. Tus derechos</h2>
        <p>De acuerdo con la Ley 19.628 sobre Protección de la Vida Privada, tienes derecho a acceder, rectificar, cancelar y oponerte al tratamiento de tus datos personales. Para ejercer estos derechos, escríbenos a <a href="mailto:contacto@fondosylicitaciones.cl">contacto@fondosylicitaciones.cl</a>.</p>
      </section>

      <section>
        <h2>7. Seguridad</h2>
        <p>Aplicamos medidas técnicas y organizativas razonables para proteger tus datos, incluyendo cifrado en tránsito (HTTPS) y políticas de control de acceso a nivel de fila (RLS) en la base de datos.</p>
      </section>

      <section>
        <h2>8. Cambios a esta política</h2>
        <p>Podemos actualizar esta política. Notificaremos cambios sustanciales mediante el correo registrado y/o un aviso en la plataforma.</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Política de Privacidad — Fondos y Licitaciones' })
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
.page { min-height: 100vh; background: #f8fafc; font-family: 'Inter', sans-serif; padding: 2.5rem 1.5rem; }
.container { max-width: 760px; margin: 0 auto; background: white; padding: 2.5rem; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
.back { display: inline-block; color: #0ea5e9; text-decoration: none; margin-bottom: 1.5rem; font-size: 0.875rem; font-weight: 500; }
.back:hover { text-decoration: underline; }
h1 { font-size: 2rem; color: #0f172a; margin-bottom: 0.4rem; }
.updated { color: #64748b; font-size: 0.875rem; margin-bottom: 2rem; }
section { margin-bottom: 1.75rem; }
h2 { font-size: 1.125rem; color: #0f172a; margin-bottom: 0.6rem; font-weight: 700; }
p { color: #334155; line-height: 1.7; font-size: 0.95rem; margin-bottom: 0.6rem; }
ul { color: #334155; line-height: 1.7; font-size: 0.95rem; padding-left: 1.5rem; margin-bottom: 0.6rem; }
li { margin-bottom: 0.4rem; }
a { color: #0ea5e9; }
strong { color: #0f172a; }
</style>
