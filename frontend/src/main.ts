import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { registerSW } from 'virtual:pwa-register'
import router from './router'
import { registerVisitRecorder } from './router/visitRecorder'
import './style.css'
import App from './App.vue'
import { useThemeStore } from '@/stores/theme'
import { usePreferencesStore } from '@/stores/preferences'
import { i18n, initDocumentLang } from '@/i18n'

registerSW({ immediate: true })

const pinia = createPinia()
const app = createApp(App)

app.use(pinia)
app.use(i18n)
app.use(router)
registerVisitRecorder(router)

initDocumentLang()
const theme = useThemeStore(pinia)
theme.initTheme()
usePreferencesStore(pinia).initPreferences()

app.mount('#app')
