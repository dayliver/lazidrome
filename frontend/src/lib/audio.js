// lib/audio.js
export const ROLES = {
  PERFORMER: 1,
  LYRICIST: 2,
  COMPOSER: 4,
  ARRANGER: 8,
  FEATURING: 16,
  PRODUCER: 32
}

export function parseRoles(mask) {
  const result = []
  if (mask & ROLES.PERFORMER) result.push('가창')
  if (mask & ROLES.LYRICIST) result.push('작사')
  if (mask & ROLES.COMPOSER) result.push('작곡')
  if (mask & ROLES.ARRANGER) result.push('편곡')
  if (mask & ROLES.FEATURING) result.push('피처링')
  if (mask & ROLES.PRODUCER) result.push('제작')
  return result.length > 0 ? result : ['참여']
}

/**
 * 초 단위 시간을 'H시간 M분' 또는 'M분'으로 포맷팅 (앨범/트랙용)
 */
export function formatDuration(seconds) {
  if (!seconds) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}시간 ${m}분`
  return `${m}분`
}

export function formatTrackTime(seconds) {
  if (!seconds) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}