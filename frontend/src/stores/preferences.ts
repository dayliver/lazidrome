import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { i18n, persistLocale, type AppLocale } from '@/i18n'
import {
  COMMON_TIMEZONES,
  getEffectiveTimezone,
  getSystemTimezone,
  readCustomTimezone,
  readTimezoneMode,
  TIMEZONE_KEY,
  TIMEZONE_MODE_KEY,
  type TimezoneMode,
  isValidIanaTimezone,
} from '@/lib/timezones'

export const usePreferencesStore = defineStore('preferences', () => {
  const locale = ref<AppLocale>(i18n.global.locale.value as AppLocale)

  const timezoneMode = ref<TimezoneMode>(readTimezoneMode())
  const customTimezone = ref(readCustomTimezone())

  const effectiveTimezone = computed(() => {
    void timezoneMode.value
    void customTimezone.value
    return getEffectiveTimezone()
  })

  const systemTimezone = computed(() => getSystemTimezone())

  const timezoneOptions = computed(() => {
    const set = new Set<string>([...COMMON_TIMEZONES, getSystemTimezone(), customTimezone.value])
    return [...set].sort((a, b) => a.localeCompare(b))
  })

  const setLocale = (next: AppLocale) => {
    locale.value = next
    persistLocale(next)
  }

  const setTimezoneMode = (mode: TimezoneMode) => {
    timezoneMode.value = mode
    localStorage.setItem(TIMEZONE_MODE_KEY, mode)
  }

  const setCustomTimezone = (tz: string) => {
    const next = isValidIanaTimezone(tz) ? tz : getSystemTimezone()
    customTimezone.value = next
    localStorage.setItem(TIMEZONE_KEY, next)
  }

  watch(locale, (v) => persistLocale(v), { immediate: false })

  const initPreferences = () => {
    persistLocale(locale.value)
  }

  return {
    locale,
    timezoneMode,
    customTimezone,
    effectiveTimezone,
    systemTimezone,
    timezoneOptions,
    setLocale,
    setTimezoneMode,
    setCustomTimezone,
    initPreferences,
  }
})
