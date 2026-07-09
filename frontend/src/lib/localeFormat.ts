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
    // SQLite CURRENT_TIMESTAMP is "YYYY-MM-DD HH:MM:SS" (UTC, no zone). Treat as UTC so
    // timeZone options (e.g. Asia/Seoul) shift correctly; bare ISO-like strings parse as local otherwise.
    const d = parseUtcOrIsoDate(iso)
    if (!d || Number.isNaN(d.getTime())) return iso
    return d.toLocaleString(getBcp47Locale(locale), options)
  } catch {
    return iso
  }
}

/** Prefer UTC for timezone-less SQL datetimes; fall back to Date parse for ISO timestamps. */
export function parseUtcOrIsoDate(raw: string): Date | null {
  const s = String(raw || '').trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(s)) {
    return new Date(s.includes('T') ? `${s}Z` : `${s.replace(' ', 'T')}Z`)
  }
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatLocaleNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
  locale?: AppLocale | string,
) {
  return Number(value ?? 0).toLocaleString(getBcp47Locale(locale), options)
}
