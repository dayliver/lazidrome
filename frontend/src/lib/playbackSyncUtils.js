export function resolveNextIndex(state) {
  const len = state.trackIds?.length ?? 0
  if (!len) return null
  if (state.isShuffle) return Math.floor(Math.random() * len)
  if (state.currentIndex < len - 1) return state.currentIndex + 1
  if (state.repeatMode === 'all') return 0
  return null
}

export function resolvePrevIndex(state) {
  const len = state.trackIds?.length ?? 0
  if (!len) return null
  if (state.currentIndex > 0) return state.currentIndex - 1
  if (state.repeatMode === 'all') return len - 1
  return state.currentIndex <= 0 ? 0 : state.currentIndex - 1
}

export function trackSummaryAt(state, tracks, index) {
  const row = tracks[index]
  if (row?.id) {
    return {
      id: String(row.id),
      title: String(row.title || ''),
      artist: String(row.artist || row.primary_artist || ''),
      album: String(row.album || ''),
    }
  }
  const id = state.trackIds[index]
  if (!id) return state.track
  return { id: String(id), title: '', artist: '', album: '' }
}
