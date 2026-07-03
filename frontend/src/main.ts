import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { registerSW } from 'virtual:pwa-register'
import router from './router'
import { registerVisitRecorder } from './router/visitRecorder'
import { registerDocumentTitle } from '@/router/documentTitle'
import './style.css'
import App from './App.vue'
import { useThemeStore } from '@/stores/theme'
import { usePreferencesStore } from '@/stores/preferences'
import { i18n, initDocumentLang } from '@/i18n'

const STALE_CHUNK_RELOAD_KEY = 'lazidrome.stale-chunk-reload'

function reloadOnceForStaleChunks() {
  if (sessionStorage.getItem(STALE_CHUNK_RELOAD_KEY)) return false
  sessionStorage.setItem(STALE_CHUNK_RELOAD_KEY, '1')
  window.location.reload()
  return true
}

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  reloadOnceForStaleChunks()
})

router.onError((error, to) => {
  const msg = error instanceof Error ? error.message : String(error)
  if (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg)
  ) {
    if (!reloadOnceForStaleChunks()) {
      window.location.assign(to.fullPath)
    }
  }
})

registerSW({ immediate: true })

window.setTimeout(() => sessionStorage.removeItem(STALE_CHUNK_RELOAD_KEY), 15_000)

const pinia = createPinia()
const app = createApp(App)

app.use(pinia)
app.use(i18n)
app.use(router)
registerVisitRecorder(router)
registerDocumentTitle(router)

initDocumentLang()
const theme = useThemeStore(pinia)
theme.initTheme()
usePreferencesStore(pinia).initPreferences()

app.mount('#app')
