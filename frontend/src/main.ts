import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import './style.css'
import App from './App.vue'
import { useThemeStore } from '@/stores/theme'

const pinia = createPinia()
const app = createApp(App)

app.use(pinia)
app.use(router)

const theme = useThemeStore(pinia)
theme.initTheme()

app.mount('#app')
