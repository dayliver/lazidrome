export const PLAYBACK_RATE_MIN = 0.5
export const PLAYBACK_RATE_MAX = 2
export const PLAYBACK_RATE_STEP = 0.1
export const MIN_LOOP_REGION_SEC = 0.5
export const LOOP_JUMP_EPSILON_SEC = 0.08

/** @param {number} raw */
export function normalizePlaybackRate(raw) {
  const n = Number(raw)
  if (!Number.isFinite(n)) return 1
  const stepped = Math.round(n / PLAYBACK_RATE_STEP) * PLAYBACK_RATE_STEP
  return Math.min(PLAYBACK_RATE_MAX, Math.max(PLAYBACK_RATE_MIN, Number(stepped.toFixed(1))))
}

/**
 * @param {number} current
 * @param {number} delta
 */
export function nudgePlaybackRate(current, delta) {
  return normalizePlaybackRate(Number(current) + Number(delta))
}

/**
 * @param {number} currentTime
 * @param {number} loopEnd
 * @param {number} [epsilon=LOOP_JUMP_EPSILON_SEC]
 */
export function shouldJumpLoopRegion(currentTime, loopEnd, epsilon = LOOP_JUMP_EPSILON_SEC) {
  const ct = Number(currentTime)
  const end = Number(loopEnd)
  if (!Number.isFinite(ct) || !Number.isFinite(end)) return false
  return ct >= end - epsilon
}

/**
 * @param {number} start
 * @param {number} end
 * @param {number} [minSec=MIN_LOOP_REGION_SEC]
 */
export function isValidLoopRegion(start, end, minSec = MIN_LOOP_REGION_SEC) {
  const a = Number(start)
  const b = Number(end)
  return Number.isFinite(a) && Number.isFinite(b) && b - a >= minSec
}
