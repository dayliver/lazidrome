export type TimezoneMode = 'system' | 'custom'

export const TIMEZONE_MODE_KEY = 'lz_timezone_mode'
export const TIMEZONE_KEY = 'lz_timezone'

/** 자주 쓰는 IANA 시간대 (설정 선택 목록) */
export const COMMON_TIMEZONES = [
  'UTC',
  'Asia/Seoul',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Australia/Sydney',
  'Pacific/Auckland',
] as const

export function getSystemTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function isValidIanaTimezone(tz: string): boolean {
  if (!tz) return false
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export function readTimezoneMode(): TimezoneMode {
  const v = localStorage.getItem(TIMEZONE_MODE_KEY)
  return v === 'custom' ? 'custom' : 'system'
}

export function readCustomTimezone(): string {
  const v = localStorage.getItem(TIMEZONE_KEY)?.trim()
  if (v && isValidIanaTimezone(v)) return v
  return getSystemTimezone()
}

/** API·차트 집계에 넘길 실제 IANA 존 */
export function getEffectiveTimezone(): string {
  if (readTimezoneMode() === 'system') return getSystemTimezone()
  return readCustomTimezone()
}
