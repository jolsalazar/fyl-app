<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
// Analytics (GA + Clarity) solo en producción: evita ensuciar las estadísticas
// con sesiones de desarrollo/localhost.
useHead({
  script: import.meta.env.PROD
    ? [
        {
          src: 'https://www.googletagmanager.com/gtag/js?id=G-6508BDMTS5',
          async: true,
        },
        {
          innerHTML: `window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-6508BDMTS5');`,
        },
        {
          type: 'text/javascript',
          innerHTML: `(function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "wixsii9zl8");`,
        },
      ]
    : [],
})
</script>
