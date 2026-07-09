import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['app-icon.svg', 'apple-touch-icon.png', 'pwa-192.png', 'pwa-512.png', 'icons.svg'],
      manifest: {
        name: 'Lazidrome',
        short_name: 'Lazidrome',
        description: 'Self-hosted music library',
        theme_color: '#863bff',
        background_color: '#0a0a0a',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,png,woff2}'],
        // hls.light는 CDN 실패 시에만 동적 로드 — SW precache에서 제외해 배포 용량 절감
        globIgnores: ['**/hls*.js'],
        navigateFallbackDenylist: [/^\/api/, /^\/assets\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5294',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
