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

/** 통계 기기 스코프: ''(전체) 또는 특정 device id */
const STATS_DEVICE_KEY = 'lz_stats_device'

function readStatsDeviceScope(): string {
  try {
    return localStorage.getItem(STATS_DEVICE_KEY) ?? ''
  } catch {
    return ''
  }
}

export const usePreferencesStore = defineStore('preferences', () => {
  const locale = ref<AppLocale>(i18n.global.locale.value as AppLocale)

  /**
   * 통계·차트가 공유하는 기기 스코프. 화면마다 따로 고르게 하면 서로 다른 수치를
   * 보게 되므로 한 곳에 둔다. ''이면 서버가 '통계 제외' 기기만 빼고 집계한다.
   */
  const statsDeviceScope = ref<string>(readStatsDeviceScope())

  const setStatsDeviceScope = (next: string) => {
    const v = String(next ?? '')
    statsDeviceScope.value = v
    try {
      if (v) localStorage.setItem(STATS_DEVICE_KEY, v)
      else localStorage.removeItem(STATS_DEVICE_KEY)
    } catch {
      /* ignore */
    }
  }

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
    statsDeviceScope,
    setStatsDeviceScope,
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
