import { t } from '@/i18n/t'

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
  if (mask & ROLES.PERFORMER) result.push(t('metadata.roleVocal'))
  if (mask & ROLES.LYRICIST) result.push(t('metadata.roleLyricist'))
  if (mask & ROLES.COMPOSER) result.push(t('metadata.roleComposer'))
  if (mask & ROLES.ARRANGER) result.push(t('metadata.roleArranger'))
  if (mask & ROLES.FEATURING) result.push(t('metadata.roleFeatured'))
  if (mask & ROLES.PRODUCER) result.push(t('metadata.roleProducer'))
  return result.length > 0 ? result : [t('metadata.roleParticipant')]
}

/** Album / playlist total length (locale-aware via vue-i18n `t`) */
export function formatDuration(seconds) {
  if (!seconds) return ''
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return t('common.listenHours', { h, m })
  if (m > 0) return t('common.listenMinutes', { m })
  return t('common.listenZero')
}

export function formatTrackTime(seconds) {
  if (!seconds) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}