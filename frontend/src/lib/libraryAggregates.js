import { t } from '@/i18n/t'

/**
 * 라이브러리 트랙 배열에서 파생되는 집계·정렬 (Pinia/Vue와 무관)
 */

export function pickTopTrackTitle(trackList) {
  if (!trackList?.length) return null
  const sorted = [...trackList].sort((a, b) => {
    const pc = (b.play_count || 0) - (a.play_count || 0)
    if (pc !== 0) return pc
    const rc = (Number(b.rating) || 0) - (Number(a.rating) || 0)
    if (rc !== 0) return rc
    return String(a.title || '').localeCompare(String(b.title || ''))
  })
  return sorted[0].title || null
}

/**
 * @param {Array<Record<string, unknown>>} allTracks
 * @returns {{ genre: string, trackCount: number, topTrack: string | null }[]}
 */
export function aggregateGenresFromTracks(allTracks) {
  if (!Array.isArray(allTracks) || !allTracks.length) return []

  const map = new Map()
  for (const t of allTracks) {
    const raw = t.genre
    const genreName = raw && String(raw).trim() ? String(raw).trim() : t('library.noGenre')
    if (!map.has(genreName)) map.set(genreName, [])
    map.get(genreName).push(t)
  }

  return [...map.entries()]
    .map(([genre, list]) => ({
      genre,
      trackCount: list.length,
      topTrack: pickTopTrackTitle(list)
    }))
    .sort((a, b) => b.trackCount - a.trackCount || String(a.genre).localeCompare(String(b.genre)))
}
