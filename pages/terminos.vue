<template>
  <div class="page">
    <div class="container">
      <NuxtLink to="/" class="back">← Volver</NuxtLink>
      <h1>Términos y Condiciones</h1>
      <p class="updated">Última actualización: mayo de 2026</p>

      <section>
        <h2>1. Quiénes somos</h2>
        <p>Fondos y Licitaciones (en adelante, "el Servicio") es operado por <strong>[Razón social, RUT, dirección]</strong>. Para consultas, escribir a <a href="mailto:contacto@fondosylicitaciones.cl">contacto@fondosylicitaciones.cl</a>.</p>
      </section>

      <section>
        <h2>2. Qué ofrecemos</h2>
        <p>El Servicio consolida información pública sobre fondos concursables, licitaciones públicas, subsidios y otras oportunidades de financiamiento, y la presenta de forma personalizada según el perfil declarado por el usuario.</p>
        <p>Toda la información proviene de fuentes públicas (CORFO, SERCOTEC, ANID, Mercado Público, Fondos.gob.cl, entre otras). El Servicio no es responsable por la exactitud, vigencia o disponibilidad de las convocatorias originales: corresponde al usuario verificar las bases oficiales antes de postular.</p>
      </section>

      <section>
        <h2>3. Cuenta de usuario</h2>
        <p>Para acceder al Servicio se requiere crear una cuenta proporcionando un correo electrónico válido y una contraseña. El usuario es responsable de mantener la confidencialidad de sus credenciales.</p>
      </section>

      <section>
        <h2>4. Planes y pagos</h2>
        <p>El Servicio se ofrece en distintos planes (Free, Starter, Advanced, Agency). Las características de cada plan se detallan en <NuxtLink to="/planes">/planes</NuxtLink>. Durante esta etapa de beta, los planes pagos pueden no estar disponibles para contratación directa; en ese caso, la asignación se realiza manualmente.</p>
      </section>

      <section>
        <h2>5. Uso aceptable</h2>
        <p>El usuario se compromete a no utilizar el Servicio para fines ilegales, a no intentar vulnerar su seguridad, ni a extraer datos de forma masiva o automatizada sin autorización expresa.</p>
      </section>

      <section>
        <h2>6. Limitación de responsabilidad</h2>
        <p>El Servicio se entrega "tal cual". No garantizamos que la información esté libre de errores ni que el funcionamiento sea ininterrumpido. No nos hacemos responsables por decisiones tomadas en base a la información presentada.</p>
      </section>

      <section>
        <h2>7. Modificaciones</h2>
        <p>Estos términos pueden actualizarse. Se notificará a los usuarios mediante el correo registrado y/o un aviso en la plataforma con razonable antelación.</p>
      </section>

      <section>
        <h2>8. Ley aplicable</h2>
        <p>Estos términos se rigen por las leyes de la República de Chile. Cualquier controversia se someterá a los tribunales ordinarios de justicia con asiento en Santiago.</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Términos y Condiciones — Fondos y Licitaciones' })
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
a { color: #0ea5e9; }
strong { color: #0f172a; }
</style>
