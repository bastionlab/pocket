import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const here = dirname(fileURLToPath(import.meta.url))

export default defineNuxtConfig({
  ssr: false,
  future: { compatibilityVersion: 4 },
  css: ['~/assets/main.css'],
  postcss: { plugins: { [join(here, 'postcss', 'hover-guard.mjs')]: {} } },
  compatibilityDate: '2025-01-01',
  app: {
    head: {
      title: 'Bastion Pocket',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#0e0e10' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'mobile-web-app-capable', content: 'yes' },
      ],
      link: [
        { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' },
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'icon', type: 'image/svg+xml', href: '/icons/icon.svg' },
      ],
    },
  },
})
