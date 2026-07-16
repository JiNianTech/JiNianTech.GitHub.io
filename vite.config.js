import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,wasm,data}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/tesseract\.js/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tesseract-core',
              expiration: { maxEntries: 5, maxAgeSeconds: 30 * 24 * 60 * 60 }
            }
          },
          {
            urlPattern: /tesseract.*(eng|chi_sim)\.traineddata$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tesseract-langs',
              expiration: { maxEntries: 3, maxAgeSeconds: 180 * 24 * 60 * 60 }
            }
          }
        ]
      },
      manifest: {
        name: 'iPhone 故障诊断',
        short_name: 'iPhone诊断',
        description: 'iPhone崩溃日志诊断工具 — 维修工程师专业版',
        theme_color: '#0A1628',
        background_color: '#0A1628',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 4096
  }
})
