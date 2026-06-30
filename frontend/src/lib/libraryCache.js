const CACHE_KEY = 'lazidrome.library.cache'

export function loadLibraryCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.revision) return null
    return parsed
  } catch {
    return null
  }
}

export function saveLibraryCache(payload) {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        revision: payload.revision,
        artists: payload.artists ?? [],
        albums: payload.albums ?? [],
        trackCount: payload.trackCount ?? 0,
        serverSettings: payload.serverSettings ?? null,
        savedAt: Date.now(),
      }),
    )
  } catch (err) {
    console.warn('library cache save failed:', err)
  }
}

export function clearLibraryCache() {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    /* ignore */
  }
}
