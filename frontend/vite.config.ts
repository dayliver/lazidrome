import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [
    vue(), 
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  // 💡 프록시 설정 추가: 이제 fetch('/api/tracks')만 해도 백엔드로 연결됩니다.
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5294',
        changeOrigin: true,
      }
    }
  }
})