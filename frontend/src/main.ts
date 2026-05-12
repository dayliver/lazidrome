import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { registerSW } from 'virtual:pwa-register'
import router from './router'
import { registerVisitRecorder } from './router/visitRecorder'
import './style.css'
import App from './App.vue'
import { useThemeStore } from '@/stores/theme'

registerSW({ immediate: true })

const pinia = createPinia()
const app = createApp(App)

app.use(pinia)
app.use(router)
registerVisitRecorder(router)

const theme = useThemeStore(pinia)
theme.initTheme()

app.mount('#app')
