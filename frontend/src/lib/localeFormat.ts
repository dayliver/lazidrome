import { i18n, type AppLocale } from '@/i18n'

/** vue-i18n locale → BCP 47 tag for Intl APIs */
export function getBcp47Locale(locale: AppLocale | string = i18n.global.locale.value) {
  return locale === 'ko' ? 'ko-KR' : 'en-US'
}

export function formatLocaleDateTime(
  iso: string,
  options?: Intl.DateTimeFormatOptions,
  locale?: AppLocale | string,
) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString(getBcp47Locale(locale), options)
  } catch {
    return iso
  }
}

export function formatLocaleNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
  locale?: AppLocale | string,
) {
  return Number(value ?? 0).toLocaleString(getBcp47Locale(locale), options)
}
