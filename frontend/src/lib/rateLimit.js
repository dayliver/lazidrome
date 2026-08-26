import { t } from '@/i18n/t'

/**
 * 429 응답을 사람이 읽을 수 있는 안내로 바꾼다.
 *
 * `@fastify/rate-limit`은 기본 본문이 `{ error: 'Too Many Requests' }`라 그대로 띄우면
 * 사용자는 서버 한도인지 외부 서비스(YouTube 등) 문제인지 구분할 수 없다.
 * Retry-After(초)를 읽어 언제 다시 되는지까지 알려준다.
 */

/** @returns {number | null} 남은 대기 시간(초). 헤더가 없거나 이상하면 null */
export function retryAfterSeconds(res) {
  const raw = res?.headers?.get?.('retry-after')
  if (raw == null) return null
  const secs = Number(raw)
  // Retry-After는 초 또는 HTTP-date 두 형식이 있다
  if (Number.isFinite(secs)) return Math.max(0, Math.round(secs))
  const at = Date.parse(raw)
  if (Number.isNaN(at)) return null
  return Math.max(0, Math.round((at - Date.now()) / 1000))
}

/** 초 → "3분" / "1시간 5분" 같은 대기 안내 (0이거나 모르면 null) */
export function formatRetryAfter(seconds) {
  if (seconds == null || seconds <= 0) return null
  const mins = Math.ceil(seconds / 60)
  if (mins < 60) return t('common.retryAfterMinutes', { minutes: mins })
  const hours = Math.floor(mins / 60)
  const rest = mins % 60
  return rest
    ? t('common.retryAfterHoursMinutes', { hours, minutes: rest })
    : t('common.retryAfterHours', { hours })
}

/**
 * 429면 안내 문구를 담은 Error, 아니면 null.
 * @param {Response} res
 * @param {string} fallbackKey 대기 시간을 모를 때 쓸 i18n 키
 */
export function rateLimitError(res, fallbackKey = 'common.rateLimited') {
  if (res?.status !== 429) return null
  const wait = formatRetryAfter(retryAfterSeconds(res))
  const error = new Error(
    wait ? t('common.rateLimitedRetryIn', { wait }) : t(fallbackKey)
  )
  error.status = 429
  error.retryAfterSec = retryAfterSeconds(res)
  return error
}
