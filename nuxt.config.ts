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

  experimental: {
    appManifest: false,
  },
})
