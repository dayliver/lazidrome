import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

const STORAGE_KEY = 'lz_theme'
type ThemeMode = 'light' | 'dark' | 'system'

export const useThemeStore = defineStore('theme', () => {
  const initial = (localStorage.getItem(STORAGE_KEY) as ThemeMode | null) || 'system'
  const mode = ref<ThemeMode>(initial)
  const isDark = ref(false)

  const effectiveMode = computed<'light' | 'dark'>(() => {
    if (mode.value === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return mode.value
  })

  const applyThemeClass = () => {
    const root = document.documentElement
    const dark = effectiveMode.value === 'dark'
    isDark.value = dark
    root.classList.toggle('dark', dark)
  }

  const setMode = (next: ThemeMode) => {
    mode.value = next
  }

  const toggle = () => {
    mode.value = effectiveMode.value === 'dark' ? 'light' : 'dark'
  }

  watch(mode, () => {
    localStorage.setItem(STORAGE_KEY, mode.value)
    applyThemeClass()
  })

  const initTheme = () => {
    applyThemeClass()
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', () => {
      if (mode.value === 'system') applyThemeClass()
    })
  }

  return { mode, isDark, effectiveMode, setMode, toggle, initTheme }
})
