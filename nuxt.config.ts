// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },

  css: ['~/assets/css/global.css'],

  app: {
    head: {
      title: 'Fondos y Licitaciones',
      meta: [
        { name: 'msapplication-TileColor', content: '#ffffff' },
        { name: 'msapplication-TileImage', content: '/ms-icon-144x144.png' },
        { name: 'theme-color', content: '#ffffff' },
      ],
      link: [
        { rel: 'apple-touch-icon', sizes: '57x57',   href: '/apple-icon-57x57.png' },
        { rel: 'apple-touch-icon', sizes: '60x60',   href: '/apple-icon-60x60.png' },
        { rel: 'apple-touch-icon', sizes: '72x72',   href: '/apple-icon-72x72.png' },
        { rel: 'apple-touch-icon', sizes: '76x76',   href: '/apple-icon-76x76.png' },
        { rel: 'apple-touch-icon', sizes: '114x114', href: '/apple-icon-114x114.png' },
        { rel: 'apple-touch-icon', sizes: '120x120', href: '/apple-icon-120x120.png' },
        { rel: 'apple-touch-icon', sizes: '144x144', href: '/apple-icon-144x144.png' },
        { rel: 'apple-touch-icon', sizes: '152x152', href: '/apple-icon-152x152.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-icon-180x180.png' },
        { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/android-icon-192x192.png' },
        { rel: 'icon', type: 'image/png', sizes: '32x32',   href: '/favicon-32x32.png' },
        { rel: 'icon', type: 'image/png', sizes: '96x96',   href: '/favicon-96x96.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16',   href: '/favicon-16x16.png' },
        { rel: 'manifest', href: '/manifest.json' },
        { rel: 'msapplication-config', href: '/browserconfig.xml' },
      ],
    },
  },

  modules: ['@nuxtjs/supabase'],

  supabase: {
    redirect: false,
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_KEY,
  },

  runtimeConfig: {
    public: {
      // Siempre true: los botones de checkout MP se muestran siempre.
      // La validación real de que MP_ACCESS_TOKEN esté configurado ocurre
      // server-side en /api/mercadopago/create-preapproval (devuelve 503 si falta).
      // process.env.MP_ACCESS_TOKEN se evalúa en build time en Cloudflare Pages,
      // donde los secrets NO están disponibles, por lo que siempre daba false.
      mpEnabled: true,
    },
  },

  nitro: {
    preset: 'cloudflare-pages',
  },

  experimental: {
    appManifest: false,
  },

  // ── Cabeceras de seguridad ────────────────────────────────────────
  routeRules: {
    '/**': {
      headers: {
        // Evita que la app se incruste en iframes (clickjacking)
        'X-Frame-Options': 'DENY',

        // Evita que el browser "adivine" el tipo MIME de los archivos
        'X-Content-Type-Options': 'nosniff',

        // No enviar el Referer completo a sitios externos
        'Referrer-Policy': 'strict-origin-when-cross-origin',

        // Forzar HTTPS por 1 año
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',

        // Deshabilitar APIs del browser que no usamos
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',

        // Content Security Policy
        // script-src necesita 'unsafe-inline' por los scripts de Analytics/Clarity en app.vue
        // connect-src es la línea de defensa clave: limita adónde puede enviar datos el JS
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://*.clarity.ms https://static.cloudflareinsights.com",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com data:",
          "img-src 'self' data: blob: https:",
          "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.resend.com https://api.mercadopago.com https://www.google-analytics.com https://region1.google-analytics.com https://*.clarity.ms https://www.googletagmanager.com",
          "frame-ancestors 'none'",
          "form-action 'self'",
          "base-uri 'self'",
          "upgrade-insecure-requests",
        ].join('; '),
      },
    },
  },
})
