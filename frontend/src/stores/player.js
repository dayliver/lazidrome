import { defineStore } from 'pinia'
import { ref, computed, shallowRef, watch } from 'vue'
import { useAuthStore } from './auth'
import { useLibraryStore } from './library'

const FADE_BEFORE_END_SEC = 5
/** 다음 곡 URL을 미리 받아 둘 시점(끝나기 N초 전) */
const PRELOAD_LEAD_SEC = 45
const QUEUE_STORAGE_KEY = 'lazidrome.queue.v1'

let queuePersistTimer = null
/** `App`에서 라이브러리 로드·복원 후 `beginPersistingQueue()` 호출 전까지는 빈 대기열로 스냅샷을 지우지 않음 */
let queuePersistenceMayWrite = false

/**
 * 브라우저는 audio.src를 절대 URL로만 돌려주는데, 설정의 serverUrl은 빈 문자열(상대 `/api/...`)일 수 있어
 * `audio.src !== streamUrl` 비교만 하면 매번 다른 문자열로 간주되어 load()+peak 초기화가 반복된다.
 */
function streamTrackIdFromAudioSrc(src) {
  if (!src || typeof src !== 'string') return null
  try {
    const base =
      typeof window !== 'undefined' && window.location?.href
        ? window.location.href
        : 'http://127.0.0.1/'
    const u = new URL(src, base)
    const m = u.pathname.match(/\/api\/stream\/([^/]+)/)
    return m ? decodeURIComponent(m[1]) : null
  } catch {
    return null
  }
}

let audioListenersBound = false
/** src 교체·수동 스킵 시 발생하는 가짜 `ended` 무시 */
let suppressTrackEnded = false
let preloadedNextId = null
let playRetryTimer = null
/** trackId → 전체 스트림 URL (서명 포함). 백그라운드 곡 전환 시 await 없이 src 교체 */
const streamUrlByTrackId = new Map()

export const usePlayerStore = defineStore('player', () => {
  const auth = useAuthStore()
  const library = useLibraryStore()

  const _audio = new Audio()
  _audio.crossOrigin = 'anonymous'
  _audio.setAttribute('playsinline', '')
  _audio.setAttribute('webkit-playsinline', '')
  const audio = shallowRef(_audio)

  const _preloadAudio = new Audio()
  _preloadAudio.crossOrigin = 'anonymous'
  _preloadAudio.preload = 'auto'
  _preloadAudio.setAttribute('playsinline', '')
  _preloadAudio.setAttribute('webkit-playsinline', '')

  // --- 상태 (State) ---
  const queue = ref([])

  library.subscribeTrackExternalSync((row) => {
    if (!row?.id) return
    const id = String(row.id)
    for (let i = 0; i < queue.value.length; i++) {
      const t = queue.value[i]
      if (t && String(t.id) === id) Object.assign(t, row)
    }
  })
  const currentIndex = ref(-1)
  const isPlaying = ref(false)
  const volume = ref(50)
  const currentTime = ref(0)
  const duration = ref(0)
  const isShuffle = ref(false)
  const repeatMode = ref('off')

  const isExpanded = ref(false)
  const isQueueView = ref(false)

  /** 현재 세션에서 이 트랙에 도달한 최대 재생 위치(초) — 50% 이상이면 재생 횟수 반영 */
  const playSessionTrackId = ref(null)
  const playSessionPeakSec = ref(0)

  const userVolumeLinear = () => Math.max(0, Math.min(1, volume.value / 100))

  const syncUserVolumeToAudio = () => {
    audio.value.volume = userVolumeLinear()
  }

  const hasNextTrackAutoplay = () => {
    if (queue.value.length === 0) return false
    if (repeatMode.value === 'one') return false
    if (isShuffle.value) return true
    if (currentIndex.value < queue.value.length - 1) return true
    if (repeatMode.value === 'all') return true
    return false
  }

  const applyEndFadeIfForeground = () => {
    if (typeof document === 'undefined' || document.visibilityState !== 'visible') return
    const dur = audio.value.duration
    const ct = audio.value.currentTime
    if (!Number.isFinite(dur) || dur <= 0 || !Number.isFinite(ct)) return
    const remaining = dur - ct
    const u = userVolumeLinear()
    if (!hasNextTrackAutoplay() || remaining > FADE_BEFORE_END_SEC) {
      if (audio.value.volume !== u) audio.value.volume = u
      return
    }
    if (remaining <= 0) return
    const factor = remaining / FADE_BEFORE_END_SEC
    audio.value.volume = u * factor
  }

  const currentTrack = computed(() => {
    if (currentIndex.value >= 0 && currentIndex.value < queue.value.length) {
      return queue.value[currentIndex.value]
    }
    return null
  })

  const progress = computed({
    get: () => [(duration.value === 0 ? 0 : (currentTime.value / duration.value) * 100)],
    set: (val) => {
      const time = (val[0] / 100) * duration.value
      audio.value.currentTime = time
    },
  })

  const toggleExpand = () => {
    isExpanded.value = !isExpanded.value
    if (!isExpanded.value) isQueueView.value = false
  }

  const toggleQueueView = () => {
    isQueueView.value = !isQueueView.value
  }

  const flushPlaySessionToServer = () => {
    if (!auth.token) return
    const sessionTrackId = playSessionTrackId.value
    if (sessionTrackId == null) return
    const peakSnapshot = playSessionPeakSec.value
    playSessionTrackId.value = null
    playSessionPeakSec.value = 0
    void library.recordTrackPlay(sessionTrackId, peakSnapshot)
  }

  const clearPreloadBuffer = () => {
    preloadedNextId = null
    _preloadAudio.src = ''
  }

  const resetPlaybackBuffers = () => {
    clearPreloadBuffer()
    clearStreamUrlCache()
  }

  const resolveNextIndex = () => {
    if (queue.value.length === 0) return null
    if (isShuffle.value) {
      return Math.floor(Math.random() * queue.value.length)
    }
    if (currentIndex.value < queue.value.length - 1) {
      return currentIndex.value + 1
    }
    if (repeatMode.value === 'all') return 0
    return null
  }

  const getNextQueueTrack = () => {
    const ni = resolveNextIndex()
    if (ni == null || ni < 0 || ni >= queue.value.length) return null
    return queue.value[ni] ?? null
  }

  const composeStreamUrl = (trackId) => {
    const mediaQuery = auth.getStreamMediaQuerySync(trackId)
    if (!mediaQuery) return ''
    const id = encodeURIComponent(String(trackId))
    const base = (auth.serverUrl || '').replace(/\/$/, '')
    if (base) return `${base}/api/stream/${id}?${mediaQuery}`
    return `/api/stream/${id}?${mediaQuery}`
  }

  const cacheStreamUrl = (trackId, url) => {
    if (trackId && url) streamUrlByTrackId.set(String(trackId), url)
  }

  const getCachedStreamUrl = (trackId) => streamUrlByTrackId.get(String(trackId)) ?? ''

  const clearStreamUrlCache = () => streamUrlByTrackId.clear()

  const buildStreamUrl = async (trackId) => {
    const cached = getCachedStreamUrl(trackId)
    if (cached) return cached
    let mediaQuery = auth.getStreamMediaQuerySync(trackId)
    if (!mediaQuery) {
      mediaQuery = await auth.ensureStreamSignature(trackId)
    }
    if (!mediaQuery) return null
    const url = composeStreamUrl(trackId)
    cacheStreamUrl(trackId, url)
    return url
  }

  /** 대기열 스트림 서명·URL을 미리 채움 — 모바일 백그라운드 전환용 */
  const warmStreamUrlCache = async (tracks = queue.value) => {
    if (!auth.token) return
    const list = Array.isArray(tracks) ? tracks : queue.value
    let targets = list
    if (list.length > 48) {
      const cur = Math.max(0, currentIndex.value)
      targets = []
      for (let i = 0; i < 24; i++) {
        const t = list[(cur + i) % list.length]
        if (t) targets.push(t)
      }
    }
    const ids = [...new Set(targets.map((t) => (t?.id != null ? String(t.id) : null)).filter(Boolean))]
    if (!ids.length) return
    await auth.prefetchStreamSignatures(ids)
    for (const id of ids) {
      const url = composeStreamUrl(id)
      if (url) cacheStreamUrl(id, url)
    }
  }

  const playWhenReady = async (el = audio.value) => {
    if (!el?.src) return
    if (el.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      await el.play()
      return
    }
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => resolve(), 12_000)
      const onReady = () => {
        clearTimeout(timeout)
        cleanup()
        resolve()
      }
      const onError = () => {
        clearTimeout(timeout)
        cleanup()
        reject(new Error('audio load failed'))
      }
      const cleanup = () => {
        el.removeEventListener('canplay', onReady)
        el.removeEventListener('error', onError)
      }
      el.addEventListener('canplay', onReady, { once: true })
      el.addEventListener('error', onError, { once: true })
    })
    await el.play()
  }

  /** 화면 꺼짐·iOS 백그라운드에서 `play()`가 막힐 때 짧게 재시도 */
  const schedulePlayRetry = () => {
    if (playRetryTimer != null) clearTimeout(playRetryTimer)
    let attempts = 0
    const tick = async () => {
      if (!isPlaying.value || attempts >= 10) return
      if (!audio.value.paused) return
      try {
        await audio.value.play()
      } catch {
        /* ignore */
      }
      attempts += 1
      if (isPlaying.value && audio.value.paused) {
        playRetryTimer = setTimeout(tick, 400)
      }
    }
    playRetryTimer = setTimeout(tick, 250)
  }

  const syncMediaSessionPosition = () => {
    if (typeof navigator === 'undefined' || !navigator.mediaSession?.setPositionState) return
    const dur = audio.value.duration
    const pos = audio.value.currentTime
    if (!Number.isFinite(dur) || dur <= 0 || !Number.isFinite(pos)) return
    try {
      navigator.mediaSession.setPositionState({
        duration: dur,
        playbackRate: 1,
        position: Math.min(pos, dur),
      })
    } catch {
      /* 일부 브라우저 미지원 */
    }
  }

  const playCurrentImmediate = () => {
    isPlaying.value = true
    if (typeof navigator !== 'undefined' && navigator.mediaSession) {
      navigator.mediaSession.playbackState = 'playing'
    }
    try {
      const p = audio.value.play()
      if (p?.catch) {
        p.catch(() => schedulePlayRetry())
      }
    } catch {
      schedulePlayRetry()
    }
  }

  const applyStreamUrlToMainAudio = (track, streamUrl) => {
    if (!track?.id || !streamUrl) return
    suppressTrackEnded = true
    try {
      playSessionPeakSec.value = 0
      if (audio.value.src !== streamUrl) {
        audio.value.src = streamUrl
        audio.value.load()
      }
      playSessionTrackId.value = track.id
      syncUserVolumeToAudio()
      syncMediaSession()
    } finally {
      suppressTrackEnded = false
    }
  }

  const preloadUpcomingTrack = () => {
    if (!hasNextTrackAutoplay()) {
      clearPreloadBuffer()
      return
    }
    const nextTrack = getNextQueueTrack()
    if (!nextTrack?.id) return
    const nextId = String(nextTrack.id)
    let url = getCachedStreamUrl(nextId)
    if (!url) {
      void auth.prefetchStreamSignatures([nextId]).then(() => {
        url = composeStreamUrl(nextId)
        if (!url) return
        cacheStreamUrl(nextId, url)
        preloadedNextId = nextId
        if (_preloadAudio.src !== url) {
          _preloadAudio.src = url
          _preloadAudio.load()
        }
      })
      return
    }
    preloadedNextId = nextId
    if (_preloadAudio.src !== url) {
      _preloadAudio.src = url
      _preloadAudio.load()
    }
  }

  /**
   * 곡 종료·잠금화면 next — await 없이 URL 교체 + play() (모바일 백그라운드)
   */
  const advanceToNextTrackSync = () => {
    flushPlaySessionToServer()
    const ni = resolveNextIndex()
    if (ni == null) {
      pause()
      if (typeof navigator !== 'undefined' && navigator.mediaSession) {
        navigator.mediaSession.playbackState = 'none'
      }
      return
    }
    currentIndex.value = ni
    const track = queue.value[ni]
    if (!track?.id) return

    let streamUrl = ''
    if (preloadedNextId === String(track.id) && _preloadAudio.src) {
      streamUrl = _preloadAudio.src
      clearPreloadBuffer()
    } else {
      streamUrl = getCachedStreamUrl(track.id) || composeStreamUrl(track.id)
    }

    if (!streamUrl) {
      void advanceToNextTrackAsync()
      return
    }

    cacheStreamUrl(track.id, streamUrl)
    applyStreamUrlToMainAudio(track, streamUrl)
    playCurrentImmediate()
    void warmStreamUrlCache()
    preloadUpcomingTrack()
  }

  const advanceToNextTrackAsync = async () => {
    if (!currentTrack.value?.id) return
    await startPlayback()
  }

  const bumpPlaySessionPeak = () => {
    const tr = currentTrack.value
    if (!tr?.id || playSessionTrackId.value == null) return
    if (String(tr.id) !== String(playSessionTrackId.value)) return
    const t = audio.value.currentTime
    if (!Number.isFinite(t) || t < 0) return
    playSessionPeakSec.value = Math.max(playSessionPeakSec.value, t)
  }

  let mediaSessionHandlersBound = false

  const syncMediaSession = () => {
    if (typeof navigator === 'undefined' || !navigator.mediaSession) return

    const tr = currentTrack.value
    if (!tr?.id) {
      navigator.mediaSession.metadata = null
      navigator.mediaSession.playbackState = 'none'
      return
    }

    const title = tr.title || 'Unknown'
    const artist = tr.artist || 'Unknown Artist'
    const album = tr.album || undefined
    const cover = auth.token
      ? auth.coverSrc('track', tr.id)
      : ''
    const artwork = cover ? [{ src: cover, sizes: '512x512', type: 'image/jpeg' }] : []

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist,
        ...(album ? { album } : {}),
        artwork,
      })
    } catch {
      navigator.mediaSession.metadata = new MediaMetadata({ title, artist })
    }
    navigator.mediaSession.playbackState = isPlaying.value ? 'playing' : 'paused'
  }

  const bindMediaSessionHandlers = () => {
    if (typeof navigator === 'undefined' || !navigator.mediaSession || mediaSessionHandlersBound) return
    mediaSessionHandlersBound = true
    try {
      navigator.mediaSession.setActionHandler('play', () => {
        void play()
      })
      navigator.mediaSession.setActionHandler('pause', () => {
        pause()
      })
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        void prev()
      })
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        advanceToNextTrackSync()
      })
      navigator.mediaSession.setActionHandler('stop', () => {
        pause()
      })
    } catch {
      /* optional handlers */
    }
  }

  watch([currentTrack, isPlaying, volume], () => syncMediaSession(), { deep: true })

  const initAudio = () => {
    if (audioListenersBound) return
    audioListenersBound = true
    syncUserVolumeToAudio()
    bindMediaSessionHandlers()
    syncMediaSession()

    audio.value.addEventListener('timeupdate', () => {
      currentTime.value = audio.value.currentTime
      bumpPlaySessionPeak()
      applyEndFadeIfForeground()
      syncMediaSessionPosition()
      const dur = audio.value.duration
      const ct = audio.value.currentTime
      if (
        Number.isFinite(dur) &&
        dur > 0 &&
        Number.isFinite(ct) &&
        dur - ct <= PRELOAD_LEAD_SEC &&
        hasNextTrackAutoplay()
      ) {
        preloadUpcomingTrack()
      }
    })
    audio.value.addEventListener('seeked', () => {
      bumpPlaySessionPeak()
      syncUserVolumeToAudio()
    })
    audio.value.addEventListener('loadedmetadata', () => {
      duration.value = audio.value.duration
      bumpPlaySessionPeak()
    })
    audio.value.addEventListener('ended', () => {
      if (suppressTrackEnded) return
      if (repeatMode.value === 'one') {
        flushPlaySessionToServer()
        playSessionPeakSec.value = 0
        playSessionTrackId.value = currentTrack.value?.id ?? null
        audio.value.currentTime = 0
        syncUserVolumeToAudio()
        playCurrentImmediate()
        return
      }
      advanceToNextTrackSync()
    })
    audio.value.addEventListener('play', () => {
      isPlaying.value = true
    })
    audio.value.addEventListener('pause', () => {
      isPlaying.value = false
      syncUserVolumeToAudio()
    })

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') {
          syncUserVolumeToAudio()
          return
        }
        if (isPlaying.value && audio.value.paused && audio.value.src) {
          void playWhenReady(audio.value).catch(() => schedulePlayRetry())
        }
      })
    }
  }

  const loadTrack = async () => {
    const track = currentTrack.value
    if (!track?.id) return false

    const streamUrl = await buildStreamUrl(track.id)
    if (!streamUrl) return false

    const playingId = streamTrackIdFromAudioSrc(audio.value.src)
    const sameStream = playingId != null && String(playingId) === String(track.id)

    if (!sameStream) {
      suppressTrackEnded = true
      try {
        playSessionPeakSec.value = 0
        audio.value.src = streamUrl
        audio.value.load()
      } finally {
        suppressTrackEnded = false
      }
    }
    playSessionTrackId.value = track.id
    syncUserVolumeToAudio()
    return true
  }

  const play = async () => {
    if (!audio.value.src) return
    try {
      await playWhenReady(audio.value)
      schedulePlayRetry()
    } catch (e) {
      if (e?.name !== 'AbortError') {
        console.error('재생 시작 실패:', e)
        schedulePlayRetry()
      }
    }
  }

  const startPlayback = async () => {
    const track = currentTrack.value
    if (!track?.id) return
    await warmStreamUrlCache()
    const url = getCachedStreamUrl(track.id) || (await buildStreamUrl(track.id))
    if (!url) return
    applyStreamUrlToMainAudio(track, url)
    await play()
    preloadUpcomingTrack()
  }
  const pause = () => audio.value.pause()
  const togglePlay = async () => {
    if (isPlaying.value) {
      pause()
      return
    }
    if (!audio.value.src && currentTrack.value?.id) {
      await startPlayback()
      return
    }
    await play()
  }
  const toggleShuffle = () => (isShuffle.value = !isShuffle.value)
  const toggleRepeat = () => {
    const modes = ['off', 'all', 'one']
    repeatMode.value = modes[(modes.indexOf(repeatMode.value) + 1) % modes.length]
  }

  const next = async () => {
    flushPlaySessionToServer()
    resetPlaybackBuffers()
    if (queue.value.length === 0) return
    const ni = resolveNextIndex()
    if (ni == null) {
      pause()
      return
    }
    currentIndex.value = ni
    await startPlayback()
  }

  const prev = async () => {
    if (currentTime.value > 3) {
      audio.value.currentTime = 0
      return
    }
    flushPlaySessionToServer()
    resetPlaybackBuffers()
    currentIndex.value = currentIndex.value <= 0 ? queue.value.length - 1 : currentIndex.value - 1
    await startPlayback()
  }

  const playNewQueue = async (newQueue, startIndex = 0) => {
    flushPlaySessionToServer()
    resetPlaybackBuffers()
    queue.value = [...newQueue]
    currentIndex.value = startIndex
    await startPlayback()
  }

  const playAlbum = async (albumTracks, startTrackId = null, shuffle = false) => {
    flushPlaySessionToServer()
    resetPlaybackBuffers()
    let newQueue = [...albumTracks]
    if (shuffle) {
      for (let i = newQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newQueue[i], newQueue[j]] = [newQueue[j], newQueue[i]]
      }
    }
    if (startTrackId) {
      const targetIndex = newQueue.findIndex((t) => t.id === startTrackId)
      if (targetIndex > -1) {
        const [targetTrack] = newQueue.splice(targetIndex, 1)
        newQueue.unshift(targetTrack)
      }
    }
    queue.value = newQueue
    currentIndex.value = 0
    if (shuffle) isShuffle.value = false
    await startPlayback()
  }

  const playList = async (tracks, startIndex) => {
    flushPlaySessionToServer()
    resetPlaybackBuffers()
    queue.value = [...tracks]
    currentIndex.value = startIndex
    await startPlayback()
  }

  const saveQueueSnapshot = () => {
    if (!queuePersistenceMayWrite || typeof localStorage === 'undefined') return
    if (!auth.token) return
    if (!queue.value.length) {
      try {
        localStorage.removeItem(QUEUE_STORAGE_KEY)
      } catch {
        /* ignore */
      }
      return
    }
    const trackIds = queue.value.map((t) => (t && t.id != null ? String(t.id) : null)).filter(Boolean)
    if (!trackIds.length) return
    const ci = Math.min(Math.max(0, currentIndex.value), trackIds.length - 1)
    const cur = queue.value[ci]
    const resumeHead =
      cur && cur.id != null
        ? {
            id: String(cur.id),
            title: (String(cur.title || '').trim() || '알 수 없는 곡').slice(0, 300),
          }
        : trackIds[ci]
          ? { id: String(trackIds[ci]), title: '' }
          : null
    try {
      localStorage.setItem(
        QUEUE_STORAGE_KEY,
        JSON.stringify({
          v: 1,
          trackIds,
          currentIndex: ci,
          resumeHead,
          updatedAt: Date.now(),
        })
      )
    } catch {
      /* quota */
    }
  }

  watch(
    [queue, currentIndex],
    () => {
      clearTimeout(queuePersistTimer)
      queuePersistTimer = setTimeout(saveQueueSnapshot, 350)
    },
    { deep: true }
  )

  /** localStorage에 저장된 대기열이 있는지(복원 가능한 트랙이 라이브러리에 있어야 실제 재생 가능) */
  const hasPersistedQueueSnapshot = () => {
    if (typeof localStorage === 'undefined') return false
    try {
      const raw = localStorage.getItem(QUEUE_STORAGE_KEY)
      if (!raw) return false
      const p = JSON.parse(raw)
      return Array.isArray(p?.trackIds) && p.trackIds.length > 0
    } catch {
      return false
    }
  }

  /**
   * 앱 기동 후 라이브러리 로드 뒤 호출: 마지막 대기열을 메모리로만 복원(서버 저장 없음). 자동 재생은 하지 않습니다.
   * @returns {Promise<boolean>}
   */
  const restoreQueueFromStorage = async () => {
    if (typeof localStorage === 'undefined') return false
    let raw
    try {
      raw = localStorage.getItem(QUEUE_STORAGE_KEY)
    } catch {
      return false
    }
    if (!raw) return false
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      return false
    }
    const ids = parsed?.trackIds
    if (!Array.isArray(ids) || ids.length === 0) return false
    const idx = Number.isFinite(Number(parsed.currentIndex)) ? Number(parsed.currentIndex) : 0
    const libTracks = await library.fetchTracksByIds(ids)
    const byId = new Map(libTracks.map((t) => [String(t.id), t]))
    const resolved = []
    for (const id of ids) {
      const t = byId.get(String(id))
      if (t) resolved.push(t)
    }
    if (!resolved.length) return false
    flushPlaySessionToServer()
    queue.value = resolved
    currentIndex.value = Math.min(Math.max(0, idx), resolved.length - 1)
    await loadTrack()
    pause()
    return true
  }

  const resumePersistedQueueAndPlay = async () => {
    const ok = await restoreQueueFromStorage()
    if (ok) await startPlayback()
    return ok
  }

  const beginPersistingQueue = () => {
    queuePersistenceMayWrite = true
    saveQueueSnapshot()
  }

  /**
   * localStorage 큐 스냅샷 기준 이어듣기 UI (동기).
   * @returns {{ trackId: string, title: string, total: number, restCount: number } | null}
   */
  const getPersistedQueueResumeHint = () => {
    if (typeof localStorage === 'undefined') return null
    try {
      const raw = localStorage.getItem(QUEUE_STORAGE_KEY)
      if (!raw) return null
      const p = JSON.parse(raw)
      const ids = p?.trackIds
      if (!Array.isArray(ids) || ids.length === 0) return null
      const total = ids.length
      const ci = Number.isFinite(Number(p.currentIndex)) ? Number(p.currentIndex) : 0
      const safeIdx = Math.min(Math.max(0, ci), total - 1)
      const trackId = String(ids[safeIdx] || '')
      let title = ''
      const rh = p.resumeHead
      if (rh && String(rh.id) === trackId && typeof rh.title === 'string') title = rh.title.trim()
      const restCount = Math.max(0, total - 1)
      return { trackId, title, total, restCount }
    } catch {
      return null
    }
  }

  return {
    queue,
    currentIndex,
    isPlaying,
    volume,
    currentTime,
    duration,
    isShuffle,
    repeatMode,
    isExpanded,
    isQueueView,
    currentTrack,
    progress,
    initAudio,
    play,
    pause,
    togglePlay,
    next,
    prev,
    playNewQueue,
    toggleShuffle,
    toggleRepeat,
    toggleExpand,
    toggleQueueView,
    loadTrack,
    startPlayback,
    playAlbum,
    playList,
    restoreQueueFromStorage,
    hasPersistedQueueSnapshot,
    resumePersistedQueueAndPlay,
    beginPersistingQueue,
    getPersistedQueueResumeHint,
  }
})
