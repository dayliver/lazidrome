/**
 * 이 브라우저의 기기 신원.
 * 재생 세션 동기화(playbackSync)와 재생 기록 귀속(play_history.device_id)이
 * 같은 id를 써야 "어느 기기에서 난 재생인가"가 사후에도 맞아떨어진다.
 */

const DEVICE_STORAGE_KEY = 'lazidrome.device.v1'

function randomId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `dev-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

let cachedId = null

/** localStorage에 고정되는 기기 id (지워지면 새 기기로 취급된다) */
export function getDeviceId() {
  if (cachedId) return cachedId
  if (typeof localStorage === 'undefined') {
    cachedId = randomId()
    return cachedId
  }
  try {
    const raw = localStorage.getItem(DEVICE_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.id) {
        cachedId = String(parsed.id)
        return cachedId
      }
    }
  } catch {
    /* ignore */
  }
  cachedId = randomId()
  try {
    localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify({ id: cachedId }))
  } catch {
    /* ignore */
  }
  return cachedId
}

/**
 * UA 기반 추정 이름. 서버는 이 값을 최초 등록에만 쓰고 이후엔 덮어쓰지 않는다
 * (사용자가 설정에서 바꾼 이름이 이깁니다).
 */
export function guessDeviceName() {
  if (typeof navigator === 'undefined') return 'Browser'
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return 'Android'
  if (/Mac OS X/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'Windows'
  if (/Linux/.test(ua)) return 'Linux'
  return 'Browser'
}
