import { i18n } from '@/i18n'

/** 초 → 차트용 "N시간 N분 N초" / "N분 N초" / "N초" */
export function formatChartListenTime(seconds) {
  const t = i18n.global.t
  const sec = Math.max(0, Math.floor(Number(seconds) || 0))
  if (sec === 0) return t('common.listenSecOnly', { s: 0 })
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return t('common.listenHms', { h, m, s })
  if (m > 0) return t('common.listenMs', { m, s })
  return t('common.listenSecOnly', { s })
}

/** 차트 행: 청취 시간 + 재생 횟수 */
export function formatChartListenWithPlays(seconds, playCount) {
  const t = i18n.global.t
  const time = formatChartListenTime(seconds)
  const n = Math.max(0, Math.floor(Number(playCount) || 0))
  if (n <= 0) return time
  return `${time} · ${t('common.plays', { count: n })}`
}

/** 초 → localized "Nh Mm" / "Mm" */
export function formatListenSeconds(seconds) {
  const t = i18n.global.t
  const sec = Math.max(0, Math.floor(Number(seconds) || 0))
  if (sec === 0) return t('common.listenZero')
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  if (h > 0) return t('common.listenHours', { h, m })
  return t('common.listenMinutes', { m })
}

/** 요일 차트: 월요일 시작 순서 */
export function orderDayOfWeekMonFirst(rows) {
  if (!Array.isArray(rows)) return []
  const t = i18n.global.t
  const order = [1, 2, 3, 4, 5, 6, 0]
  const map = Object.fromEntries(rows.map((r) => [r.dow, r]))
  return order.map((dow) => {
    const base = map[dow] ?? { dow, listenSec: 0 }
    return {
      ...base,
      dow,
      label: base.label ?? t(`stats.days.${dow}`),
      listenSec: base.listenSec ?? 0,
    }
  })
}

/** API timeOfDay buckets → labeled rows for charts */
export function labelTimeHabitBuckets(rows) {
  if (!Array.isArray(rows)) return []
  const t = i18n.global.t
  return rows.map((r) => ({
    ...r,
    label: r.label ?? (r.key ? t(`stats.buckets.${r.key}`) : ''),
  }))
}
