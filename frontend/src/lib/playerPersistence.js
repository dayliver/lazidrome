import { normalizePlaybackRate } from '@/lib/playbackAdjust'

export const QUEUE_STORAGE_KEY = 'lazidrome.queue.v1'
export const PLAYBACK_RATE_STORAGE_KEY = 'lazidrome.playbackRate'

export function loadPersistedPlaybackRate() {
  if (typeof localStorage === 'undefined') return 1
  try {
    const raw = localStorage.getItem(PLAYBACK_RATE_STORAGE_KEY)
    if (raw == null || raw === '') return 1
    return normalizePlaybackRate(raw)
  } catch {
    return 1
  }
}

export function persistPlaybackRate(rate) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(PLAYBACK_RATE_STORAGE_KEY, String(rate))
  } catch {
    /* quota */
  }
}

export function loadPersistedQueue() {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function persistQueueSnapshot(snapshot) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    /* quota */
  }
}

export function clearPersistedQueue() {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(QUEUE_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
