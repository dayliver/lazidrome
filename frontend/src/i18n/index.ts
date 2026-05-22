import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import enPages from './locales/en/pages.json'
import enUi from './locales/en/ui.json'
import ko from './locales/ko.json'
import koPages from './locales/ko/pages.json'
import koUi from './locales/ko/ui.json'

function mergeMessages(...parts: Record<string, unknown>[]) {
  return Object.assign({}, ...parts)
}

export type AppLocale = 'en' | 'ko'

const STORAGE_KEY = 'lz_locale'

function detectInitialLocale(): AppLocale {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'en' || saved === 'ko') return saved
  const lang = typeof navigator !== 'undefined' ? navigator.language : ''
  return lang.toLowerCase().startsWith('ko') ? 'ko' : 'en'
}

export const i18n = createI18n({
  legacy: false,
  locale: detectInitialLocale(),
  fallbackLocale: 'en',
  messages: {
    en: mergeMessages(en, enPages, enUi),
    ko: mergeMessages(ko, koPages, koUi),
  },
})

export function persistLocale(locale: AppLocale) {
  localStorage.setItem(STORAGE_KEY, locale)
  i18n.global.locale.value = locale
  document.documentElement.lang = locale
}

export function initDocumentLang() {
  document.documentElement.lang = i18n.global.locale.value
}
