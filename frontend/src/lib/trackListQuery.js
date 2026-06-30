export const DEFAULT_TRACK_LIST_QUERY = {
  sorts: [],
  q: '',
  starred: false,
  minRating: null,
}

export const TRACKS_PAGE_SORT_COLUMNS = [
  { key: 'title', labelKey: 'trackTable.title' },
  { key: 'artist', labelKey: 'trackTable.artist' },
  { key: 'album', labelKey: 'trackTable.album' },
  { key: 'rating', labelKey: 'trackTable.rating' },
  { key: 'play_count', labelKey: 'trackTable.playCount' },
  { key: 'scanned_at', labelKey: 'trackTable.scannedAt' },
]

export function sortsToParam(sorts) {
  if (!Array.isArray(sorts) || !sorts.length) return ''
  return sorts.map((s) => `${s.key}:${s.order}`).join(',')
}

export function parseSortsParam(raw) {
  if (!raw || !String(raw).trim()) return []
  return String(raw)
    .split(',')
    .map((part) => {
      const [key, order] = part.split(':').map((s) => s.trim())
      if (!key) return null
      return { key, order: order === 'desc' ? 'desc' : 'asc' }
    })
    .filter(Boolean)
}

export const TRACK_SORT_OPTIONS = [
  { value: 'scanned_at', labelKey: 'trackList.sort.scannedAt' },
  { value: 'title', labelKey: 'trackList.sort.title' },
  { value: 'artist', labelKey: 'trackList.sort.artist' },
  { value: 'album', labelKey: 'trackList.sort.album' },
  { value: 'year', labelKey: 'trackList.sort.year' },
  { value: 'duration', labelKey: 'trackList.sort.duration' },
  { value: 'rating', labelKey: 'trackList.sort.rating' },
  { value: 'play_count', labelKey: 'trackList.sort.playCount' },
  { value: 'last_played', labelKey: 'trackList.sort.lastPlayed' },
]

const CLIENT_SORT_BASE = TRACK_SORT_OPTIONS.filter((o) => o.value !== 'scanned_at')

export const TRACK_SORT_PRESETS = {
  tracksPage: {
    defaultQuery: { ...DEFAULT_TRACK_LIST_QUERY },
    sortOptions: TRACK_SORT_OPTIONS,
  },
  album: {
    defaultQuery: {
      sort: 'track_number',
      order: 'asc',
      q: '',
      starred: false,
      minRating: null,
    },
    sortOptions: [
      { value: 'track_number', labelKey: 'trackList.sort.trackNumber' },
      ...CLIENT_SORT_BASE,
    ],
  },
  artist: {
    defaultQuery: {
      sort: 'play_count',
      order: 'desc',
      q: '',
      starred: false,
      minRating: null,
    },
    sortOptions: CLIENT_SORT_BASE,
  },
  tag: {
    defaultQuery: {
      sort: 'title',
      order: 'asc',
      q: '',
      starred: false,
      minRating: null,
    },
    sortOptions: CLIENT_SORT_BASE,
  },
  playlist: {
    defaultQuery: {
      sort: 'manual',
      order: 'asc',
      q: '',
      starred: false,
      minRating: null,
    },
    sortOptions: [
      { value: 'manual', labelKey: 'trackList.sort.manual' },
      ...CLIENT_SORT_BASE,
    ],
  },
}

const STORAGE_KEY_TRACKS_PAGE = 'lazidrome.tracksPage.query'

export function loadPersistedTrackListQuery(storageKey = STORAGE_KEY_TRACKS_PAGE) {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return {
      sorts: parseSortsParam(parsed.sorts),
      starred: Boolean(parsed.starred),
      minRating:
        Number.isFinite(Number(parsed.minRating)) && parsed.minRating >= 1 && parsed.minRating <= 5
          ? Number(parsed.minRating)
          : null,
    }
  } catch {
    return null
  }
}

export function persistTrackListQuery(query, storageKey = STORAGE_KEY_TRACKS_PAGE) {
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        sorts: sortsToParam(query.sorts),
        starred: query.starred,
        minRating: query.minRating,
      }),
    )
  } catch {
    /* ignore */
  }
}

export function storageKeyForTrackListPreset(presetKey) {
  return `lazidrome.trackList.${presetKey}`
}

/** @param {Record<string, unknown>} query */
export function trackListQueryToSearchParams(query, { offset, limit }) {
  const q = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  })
  const sorts = sortsToParam(query.sorts)
  if (sorts) q.set('sorts', sorts)
  const text = String(query.q ?? '').trim()
  if (text) q.set('q', text)
  if (query.starred) q.set('starred', '1')
  if (query.minRating != null && query.minRating >= 1) {
    q.set('minRating', String(query.minRating))
  }
  return q
}

export function hasActiveTrackListFilters(query) {
  return Boolean(
    String(query.q ?? '').trim() ||
      query.starred ||
      (query.minRating != null && query.minRating >= 1),
  )
}

function trackSearchText(track) {
  return [track?.title, track?.artist, track?.albumName, track?.album]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function compareSortValues(a, b) {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (typeof a === 'number' && typeof b === 'number') {
    if (a !== b) return a - b
    return 0
  }
  return String(a).localeCompare(String(b), undefined, { sensitivity: 'base', numeric: true })
}

function compareTracksBySort(a, b, sortKey) {
  switch (sortKey) {
    case 'track_number': {
      const discCmp = compareSortValues(Number(a.disc_number) || 0, Number(b.disc_number) || 0)
      if (discCmp !== 0) return discCmp
      return compareSortValues(Number(a.track_number) || 0, Number(b.track_number) || 0)
    }
    case 'title':
      return compareSortValues(a.title, b.title)
    case 'artist':
      return compareSortValues(a.artist, b.artist)
    case 'album':
      return compareSortValues(a.albumName ?? a.album, b.albumName ?? b.album)
    case 'year':
      return compareSortValues(a.year, b.year)
    case 'duration':
      return compareSortValues(Number(a.duration) || 0, Number(b.duration) || 0)
    case 'rating':
      return compareSortValues(Number(a.rating) || 0, Number(b.rating) || 0)
    case 'play_count':
      return compareSortValues(Number(a.play_count) || 0, Number(b.play_count) || 0)
    case 'last_played':
      return compareSortValues(a.last_played, b.last_played)
    case 'scanned_at':
      return compareSortValues(a.scanned_at, b.scanned_at)
    default:
      return compareSortValues(a.title, b.title)
  }
}

function filterTracks(tracks, query) {
  let result = [...tracks]
  const q = String(query.q ?? '').trim().toLowerCase()
  if (q) {
    result = result.filter((track) => trackSearchText(track).includes(q))
  }
  if (query.starred) {
    result = result.filter((track) => Boolean(track.starred))
  }
  if (query.minRating != null && query.minRating >= 1) {
    result = result.filter((track) => (Number(track.rating) || 0) >= query.minRating)
  }
  return result
}

/** 인메모리 트랙 배열에 정렬·필터 적용 (앨범/아티스트/태그/플레이리스트) */
export function applyTrackListQuery(tracks, query) {
  const list = Array.isArray(tracks) ? tracks : []
  const filtered = filterTracks(list, query)
  if (query.sort === 'manual') return filtered

  const dir = query.order === 'asc' ? 1 : -1
  return [...filtered].sort((a, b) => {
    const cmp = compareTracksBySort(a, b, query.sort)
    if (cmp !== 0) return cmp * dir
    return compareSortValues(a.title, b.title) * dir
  })
}

export function isManualTrackListOrder(query) {
  return query?.sort === 'manual'
}
