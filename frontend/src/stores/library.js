import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './auth'
import { t } from '@/i18n/t'
import { aggregateGenresFromTracks } from '@/lib/libraryAggregates'
import { normalizeTracksResponse } from '@/lib/tracksApi'
import { loadLibraryCache, saveLibraryCache, clearLibraryCache } from '@/lib/libraryCache'
import { normalizeCatalogResponse } from '@/lib/catalogApi'

export const useLibraryStore = defineStore('library', () => {
  const auth = useAuthStore()
  
  const tracks = ref([])
  const tracksTotal = ref(0)
  const artists = ref([])
  const albums = ref([])
  const serverSettings = ref(null)
  const libraryRevision = ref(null)

  const isSyncing = ref(false)
  const syncStatusKey = ref('library.syncIdle')
  const syncStatusText = computed(() => t(syncStatusKey.value))

  let fetchPromise = null

  /** 메타데이터 저장 후 앨범/태그/플레이리스트 등 "별도 배열"에 붙은 트랙 행을 갱신하기 위한 구독자 */
  const trackExternalSyncListeners = new Set()
  const albumExternalSyncListeners = new Set()
  const artistExternalSyncListeners = new Set()

  const trackCount = computed(() => tracksTotal.value || tracks.value.length)

  /** 트랙 메타의 genre 기준 집계 (전용 API 없음 — 페이지를 모아 집계) */
  const getGenres = async () => {
    const allTracks = []
    let offset = 0
    const limit = 200
    while (true) {
      const page = await fetchTracksPage({ offset, limit })
      allTracks.push(...page.items)
      if (!page.hasMore) break
      offset += limit
    }
    return aggregateGenresFromTracks(allTracks)
  }

  const fetchServerSettings = async () => {
    const res = await auth.fetchWithAuth('/api/settings')
    if (!res.ok) throw new Error(t('library.settingsFetchFailed'))
    const data = await res.json()
    serverSettings.value = data
    if (data?.library?.trackCount != null) {
      tracksTotal.value = Number(data.library.trackCount) || 0
    }
    return data
  }

  const fetchTracksPage = async ({
    offset = 0,
    limit = 50,
    sorts,
    q,
    starred,
    minRating,
    genre,
    artistId,
    albumId,
    tag,
  } = {}) => {
    const params = new URLSearchParams({
      offset: String(offset),
      limit: String(limit),
    })
    if (sorts) params.set('sorts', sorts)
    const trimmedQ = String(q ?? '').trim()
    if (trimmedQ) params.set('q', trimmedQ)
    if (starred) params.set('starred', '1')
    if (minRating != null && minRating >= 1) params.set('minRating', String(minRating))
    if (genre) params.set('genre', String(genre))
    if (artistId) params.set('artistId', String(artistId))
    if (albumId) params.set('albumId', String(albumId))
    if (tag) params.set('tag', String(tag))

    const res = await auth.fetchWithAuth(`/api/tracks?${params}`)
    if (!res.ok) throw new Error(t('library.tracksFetchFailed'))
    const body = await res.json()
    const page = normalizeTracksResponse(body)
    tracksTotal.value = page.total
    return page
  }

  const fetchTracksByIds = async (ids) => {
    const list = [...new Set(ids.map((id) => String(id)).filter(Boolean))]
    if (!list.length) return []
    const q = new URLSearchParams({ ids: list.join(',') })
    const res = await auth.fetchWithAuth(`/api/tracks?${q}`)
    if (!res.ok) throw new Error(t('library.trackFetchFailed'))
    const body = await res.json()
    return normalizeTracksResponse(body).items
  }

  const searchTracks = async (query, limit = 10) => {
    const trimmed = String(query ?? '').trim()
    if (!trimmed) return []
    const q = new URLSearchParams({ q: trimmed, limit: String(limit) })
    const res = await auth.fetchWithAuth(`/api/tracks?${q}`)
    if (!res.ok) throw new Error(t('library.searchFailed'))
    const body = await res.json()
    return normalizeTracksResponse(body).items
  }

  const fetchAlbumsPage = async ({ offset = 0, limit = 60, q } = {}) => {
    const params = new URLSearchParams({
      offset: String(offset),
      limit: String(limit),
    })
    const trimmedQ = String(q ?? '').trim()
    if (trimmedQ) params.set('q', trimmedQ)
    const res = await auth.fetchWithAuth(`/api/albums?${params}`)
    if (!res.ok) throw new Error(t('library.albumsFetchFailed'))
    const body = await res.json()
    return normalizeCatalogResponse(body)
  }

  const fetchArtistsPage = async ({ offset = 0, limit = 60, q, sort } = {}) => {
    const params = new URLSearchParams({
      offset: String(offset),
      limit: String(limit),
    })
    const trimmedQ = String(q ?? '').trim()
    if (trimmedQ) params.set('q', trimmedQ)
    if (sort) params.set('sort', String(sort))
    const res = await auth.fetchWithAuth(`/api/artists?${params}`)
    if (!res.ok) throw new Error(t('library.artistsFetchFailed'))
    const body = await res.json()
    return normalizeCatalogResponse(body)
  }

  const searchAlbums = async (query, limit = 12) => {
    const trimmed = String(query ?? '').trim()
    if (!trimmed) return []
    const page = await fetchAlbumsPage({ offset: 0, limit, q: trimmed })
    return page.items
  }

  const searchArtists = async (query, limit = 12) => {
    const trimmed = String(query ?? '').trim()
    if (!trimmed) return []
    const page = await fetchArtistsPage({ offset: 0, limit, q: trimmed })
    return page.items
  }

  const createAlbum = async (name, year = null) => {
    const res = await auth.fetchWithAuth('/api/albums', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: String(name ?? '').trim(),
        ...(year != null ? { year } : {}),
      }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || !body?.success) {
      throw new Error(body?.error || t('library.albumCreateFailed'))
    }
    await fetchLibrary({ force: true })
    return body.data?.id
  }

  const fetchLibraryRevision = async () => {
    const res = await auth.fetchWithAuth('/api/library/revision')
    if (!res.ok) throw new Error(t('library.revisionFetchFailed'))
    return res.json()
  }

  const applyLibrarySnapshot = ({ revision, trackCount, settings }) => {
    if (revision) libraryRevision.value = revision
    tracks.value = []
    if (trackCount != null) tracksTotal.value = Number(trackCount) || 0
    if (settings) serverSettings.value = settings
  }

  const hydrateLibraryFromCache = (revisionData) => {
    const cached = loadLibraryCache()
    if (!cached || cached.revision !== revisionData.revision) return false

    applyLibrarySnapshot({
      revision: revisionData.revision,
      trackCount: revisionData.trackCount ?? cached.trackCount,
      settings: cached.serverSettings,
    })
    return true
  }

  const clearLibrarySession = () => {
    libraryRevision.value = null
    artists.value = []
    albums.value = []
    tracks.value = []
    tracksTotal.value = 0
    serverSettings.value = null
    clearLibraryCache()
    fetchPromise = null
  }

  const fetchLibrary = async ({ force = false } = {}) => {
    if (fetchPromise) return fetchPromise

    fetchPromise = (async () => {
      isSyncing.value = true
      syncStatusKey.value = 'library.syncFetching'

      try {
        const revisionData = await fetchLibraryRevision()
        const revision = revisionData.revision

        if (
          !force &&
          libraryRevision.value === revision &&
          libraryRevision.value != null
        ) {
          if (revisionData.trackCount != null) {
            tracksTotal.value = Number(revisionData.trackCount) || 0
          }
          syncStatusKey.value = 'library.syncDone'
          return
        }

        if (!force && hydrateLibraryFromCache(revisionData)) {
          syncStatusKey.value = 'library.syncDone'
          return
        }

        try {
          await fetchServerSettings()
        } catch {
          try {
            const meta = await fetchTracksPage({ offset: 0, limit: 1 })
            revisionData.trackCount = meta.total
          } catch {
            /* ignore */
          }
        }

        applyLibrarySnapshot({
          revision,
          trackCount: revisionData.trackCount ?? tracksTotal.value,
          settings: serverSettings.value,
        })

        saveLibraryCache({
          revision,
          trackCount: tracksTotal.value,
          serverSettings: serverSettings.value,
        })

        syncStatusKey.value = 'library.syncDone'
      } catch (error) {
        console.error('❌ 데이터 로드 실패:', error)
        syncStatusKey.value = 'library.syncError'
      } finally {
        isSyncing.value = false
        fetchPromise = null
      }
    })()

    return fetchPromise
  }

  /** @deprecated 페이지 API 사용 권장 */
  const getTracks = async () => tracks.value

  const getArtists = async ({ q, limit = 200 } = {}) => {
    if (q) return searchArtists(q, limit)
    const page = await fetchArtistsPage({ offset: 0, limit })
    artists.value = page.items
    return page.items
  }

  const getAlbums = async ({ q, limit = 200 } = {}) => {
    if (q) return searchAlbums(q, limit)
    const page = await fetchAlbumsPage({ offset: 0, limit })
    albums.value = page.items
    return page.items
  }

  const updateTrackRating = async (trackId, rating) => {
    try {
      // 백엔드: PATCH /api/tracks/:id/rate
      const res = await auth.fetchWithAuth(`/api/tracks/${trackId}/rate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating })
      })

      if (res.ok) {
        const track = tracks.value.find(t => t.id === trackId)
        if (track) track.rating = rating
        emitTrackExternalSync({ id: trackId, rating })
      }
    } catch (err) {
      console.error('별점 서버 전송 실패:', err)
    }
  }

  const toggleTrackStar = async (trackId, starred) => {
    try {
      // 💡 별점과 하트 모두 퀵 업데이트이므로 같은 라우트를 재사용합니다.
      const res = await auth.fetchWithAuth(`/api/tracks/${trackId}/rate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starred: starred ? 1 : 0 }) // SQLite를 위해 1/0으로 변환
      })

      if (res.ok) {
        const track = tracks.value.find(t => t.id === trackId)
        if (track) track.starred = starred
        emitTrackExternalSync({ id: trackId, starred: starred ? 1 : 0 })
      }
    } catch (err) {
      console.error('좋아요 서버 전송 실패:', err)
    }
  }

  const updateTrackTags = async (trackId, tags) => {
    const res = await auth.fetchWithAuth(`/api/tracks/${trackId}/rate`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags }),
    })
    if (!res.ok) {
      throw new Error('Failed to update track tags')
    }
    const track = tracks.value.find((t) => t.id === trackId)
    if (track) track.tags = tags
    emitTrackExternalSync({ id: trackId, tags })
  }

  // 💉 수술: 상세 페이지용 단일 객체 패치 함수 추가
  const getArtistById = async (id) => {
    try {
      const res = await auth.fetchWithAuth(`/api/artists/${id}`)
      if (!res.ok) throw new Error('Artist not found')
      return await res.json()
    } catch (error) {
      console.error(`❌ 아티스트 정보 로드 실패 (${id}):`, error)
      return null
    }
  }

  const getAlbumById = async (id) => {
    try {
      const res = await auth.fetchWithAuth(`/api/albums/${id}`)
      if (!res.ok) throw new Error('Album not found')
      return await res.json()
    } catch (error) {
      console.error(`❌ 앨범 정보 로드 실패 (${id}):`, error)
      return null
    }
  }

  const getTrackById = async (id) => {
    try {
      const res = await auth.fetchWithAuth(`/api/tracks/${id}`)
      if (!res.ok) throw new Error('Track not found')
      return await res.json()
    } catch (error) {
      console.error(`❌ 트랙 정보 로드 실패 (${id}):`, error)
      return null
    }
  }

  const replaceTrackAudio = async (trackId, body) => {
    const res = await auth.fetchWithAuth(`/api/tracks/${encodeURIComponent(trackId)}/replace-audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data?.error || res.statusText)
    }
    await fetchLibrary({ force: true })
    return data.data
  }

  // =====================================================================
  // 💡 [2단계 신규 추가] 국소적 변이 (Local Mutation) 함수들
  // =====================================================================
  
  const updateLocalArtist = (newData) => {
    const processedData = normalizeArtistServerPayload(newData)
    if (!processedData) return

    const index = artists.value.findIndex((a) => a.id === processedData.id)
    if (index !== -1) {
      const parsedTags = Array.isArray(processedData.tags)
        ? processedData.tags.slice(0, 3)
        : []
      Object.assign(artists.value[index], {
        ...processedData,
        topTags: parsedTags,
      })
    }

    if ('cover_type' in processedData) {
      auth.invalidateImageCache('artist', processedData.id)
    }

    emitArtistExternalSync(processedData)
  }

  const normalizeArtistServerPayload = (newData) => {
    if (!newData?.id) return null
    const processedData = { ...newData }
    if (typeof newData.tags === 'string') {
      try {
        processedData.tags = JSON.parse(newData.tags)
      } catch {
        processedData.tags = []
      }
    }
    return processedData
  }

  const subscribeArtistExternalSync = (listener) => {
    if (typeof listener !== 'function') return () => {}
    artistExternalSyncListeners.add(listener)
    return () => artistExternalSyncListeners.delete(listener)
  }

  const emitArtistExternalSync = (normalized) => {
    if (!normalized) return
    for (const fn of artistExternalSyncListeners) {
      try {
        fn(normalized)
      } catch (e) {
        console.error(e)
      }
    }
  }

  const updateLocalAlbum = (newData) => {
    const processedData = normalizeAlbumServerPayload(newData)
    if (!processedData) return

    const index = albums.value.findIndex((a) => a.id === processedData.id)
    if (index !== -1) {
      Object.assign(albums.value[index], processedData)
    }

    if ('cover_type' in processedData) {
      auth.invalidateImageCache('album', processedData.id)
    }

    emitAlbumExternalSync(processedData)
  }

  const normalizeAlbumServerPayload = (newData) => {
    if (!newData?.id) return null
    const processedData = { ...newData }
    if (typeof newData.tags === 'string') {
      try {
        processedData.tags = JSON.parse(newData.tags)
      } catch {
        processedData.tags = []
      }
    }
    return processedData
  }

  const subscribeAlbumExternalSync = (listener) => {
    if (typeof listener !== 'function') return () => {}
    albumExternalSyncListeners.add(listener)
    return () => albumExternalSyncListeners.delete(listener)
  }

  const emitAlbumExternalSync = (normalized) => {
    if (!normalized) return
    for (const fn of albumExternalSyncListeners) {
      try {
        fn(normalized)
      } catch (e) {
        console.error(e)
      }
    }
  }

  const normalizeTrackServerPayload = (newData) => {
    if (!newData?.id) return null
    const processedData = { ...newData }
    if (typeof newData.tags === 'string') {
      try {
        processedData.tags = JSON.parse(newData.tags)
      } catch {
        processedData.tags = []
      }
    }
    return processedData
  }

  const subscribeTrackExternalSync = (listener) => {
    if (typeof listener !== 'function') return () => {}
    trackExternalSyncListeners.add(listener)
    return () => trackExternalSyncListeners.delete(listener)
  }

  const emitTrackExternalSync = (normalized) => {
    if (!normalized) return
    for (const fn of trackExternalSyncListeners) {
      try {
        fn(normalized)
      } catch (e) {
        console.error(e)
      }
    }
  }

  /**
   * 재생 절반 이상 시 서버에 반영(play_history + play_count). 스트림과 동일하게 쿼리 token도 붙여 인증.
   * @param {string|number} trackId
   * @param {number} positionPeakSec timeupdate 기준 최대 currentTime(초)
   */
  const recordTrackPlay = async (trackId, positionPeakSec) => {
    if (!auth.token) return null

    const encId = encodeURIComponent(String(trackId))
    const path = `/api/tracks/${encId}/play`

    try {
      const res = await auth.fetchWithAuth(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position_peak_sec: positionPeakSec }),
      })
      const raw = await res.text()
      if (!res.ok) return null
      let body
      try {
        body = raw ? JSON.parse(raw) : null
      } catch {
        return null
      }
      if (!body) return null
      if (body?.success && body.data?.play_count != null && !body.skipped) {
        updateLocalTrack({ id: trackId, play_count: body.data.play_count })
        return body.data.play_count
      }
      return null
    } catch {
      return null
    }
  }

  const updateLocalTrack = (newData) => {
    const processedData = normalizeTrackServerPayload(newData)
    if (!processedData) return

    const index = tracks.value.findIndex((t) => String(t.id) === String(processedData.id))
    if (index !== -1) {
      Object.assign(tracks.value[index], processedData)
    }

    if ('custom_cover_type' in processedData) {
      auth.invalidateImageCache('track', processedData.id)
    }
    if ('albumCoverType' in processedData || 'albumId' in processedData) {
      const albumId = processedData.albumId
      if (albumId) auth.invalidateImageCache('album', albumId)
    }

    emitTrackExternalSync(processedData)
  }

  const homeShelves = ref(null)
  const homeShelvesLoading = ref(false)
  const homeShelvesError = ref(null)

  /**
   * 홈 선반 데이터 (GET /api/home/shelves)
   * @param {'24h'|'48h'|'7d'} [windowKey='7d']
   */
  const fetchHomeShelves = async (windowKey = '7d') => {
    if (!auth.token) {
      homeShelves.value = null
      return null
    }
    homeShelvesLoading.value = true
    homeShelvesError.value = null
    try {
      const q = new URLSearchParams({ window: windowKey })
      const res = await auth.fetchWithAuth(`/api/home/shelves?${q}`)
      if (!res.ok) {
        const t = await res.text()
        throw new Error(t || res.statusText)
      }
      const data = await res.json()
      homeShelves.value = data
      return data
    } catch (e) {
      console.error('홈 선반 로드 실패:', e)
      homeShelvesError.value = e
      homeShelves.value = null
      return null
    } finally {
      homeShelvesLoading.value = false
    }
  }

  /**
   * 재생 이벤트 집계 차트 (GET /api/stats/plays)
   * @param {'24h'|'48h'|'7d'|'30d'|'all'} range
   */
  const fetchStatsPlays = async (range = '7d') => {
    const q = new URLSearchParams({ range })
    const res = await auth.fetchWithAuth(`/api/stats/plays?${q}`)
    if (!res.ok) {
      const t = await res.text()
      throw new Error(t || res.statusText)
    }
    const body = await res.json()
    return body?.data ?? null
  }

  /**
   * 기간 내 play_history 이벤트 수 기준 상위 트랙·앨범 (GET /api/stats/top)
   * @param {'24h'|'48h'|'7d'|'30d'|'all'} range
   */
  const fetchStatsHabits = async (range = '30d', timezone) => {
    const q = new URLSearchParams({ range })
    if (timezone) q.set('timezone', timezone)
    const res = await auth.fetchWithAuth(`/api/stats/habits?${q}`)
    if (!res.ok) {
      const t = await res.text()
      throw new Error(t || res.statusText)
    }
    const body = await res.json()
    return body?.data ?? null
  }

  const fetchStatsTop = async (range = '7d', limit = 12, timezone) => {
    const q = new URLSearchParams({ range, limit: String(limit) })
    if (timezone) q.set('timezone', timezone)
    const res = await auth.fetchWithAuth(`/api/stats/top?${q}`)
    if (!res.ok) {
      const t = await res.text()
      throw new Error(t || res.statusText)
    }
    const body = await res.json()
    return body?.data ?? null
  }

  /** 홈: frequent visits + 7d top tracks/artists (1회) */
  const fetchHomeDashboard = async ({ limit = 20, visitLimit = 24, timezone } = {}) => {
    const q = new URLSearchParams({
      limit: String(limit),
      visitLimit: String(visitLimit),
    })
    if (timezone) q.set('timezone', timezone)
    const res = await auth.fetchWithAuth(`/api/home?${q}`)
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || res.statusText)
    }
    const body = await res.json()
    return body?.data ?? null
  }

  const fetchPlayHistory = async ({ limit = 50, offset = 0 } = {}) => {
    const q = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    })
    const res = await auth.fetchWithAuth(`/api/play-history?${q}`)
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || res.statusText)
    }
    const body = await res.json()
    return body?.data ?? null
  }

  return {
    tracks,
    tracksTotal,
    artists,
    albums,
    serverSettings,
    trackCount,
    isSyncing,
    syncStatusText,
    getGenres,
    fetchLibrary,
    fetchServerSettings,
    clearLibrarySession,
    fetchTracksPage,
    fetchAlbumsPage,
    fetchArtistsPage,
    searchAlbums,
    searchArtists,
    fetchTracksByIds,
    searchTracks,
    createAlbum,
    getArtists,
    getAlbums,
    getTracks,
    updateTrackRating,
    toggleTrackStar,
    updateTrackTags,
    getArtistById,
    getAlbumById,
    getTrackById,
    replaceTrackAudio,
    updateLocalArtist,
    updateLocalAlbum,
    updateLocalTrack,
    recordTrackPlay,
    subscribeTrackExternalSync,
    subscribeAlbumExternalSync,
    subscribeArtistExternalSync,
    homeShelves,
    homeShelvesLoading,
    homeShelvesError,
    fetchHomeShelves,
    fetchStatsPlays,
    fetchStatsHabits,
    fetchStatsTop,
    fetchHomeDashboard,
    fetchPlayHistory,
  }
})