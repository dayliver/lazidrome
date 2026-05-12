import { defineStore } from 'pinia'
import { ref, computed, shallowRef, watch } from 'vue'
import { useAuthStore } from './auth'
import { useLibraryStore } from './library'
import { getCoverUrl } from '@/lib/image'

const FADE_BEFORE_END_SEC = 5
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

export const usePlayerStore = defineStore('player', () => {
  const auth = useAuthStore()
  const library = useLibraryStore()

  const _audio = new Audio()
  _audio.crossOrigin = 'anonymous'
  const audio = shallowRef(_audio)

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
    const idx = currentIndex.value
    if (idx < 0 || idx >= queue.value.length) return
    const tr = queue.value[idx]
    if (!tr?.id || playSessionTrackId.value == null) return
    if (String(playSessionTrackId.value) !== String(tr.id)) return
    const peakSnapshot = playSessionPeakSec.value
    void library.recordTrackPlay(tr.id, peakSnapshot)
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
      ? getCoverUrl(auth.serverUrl, 'track', tr.id, auth.token)
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
        void next()
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
      if (repeatMode.value === 'one') {
        flushPlaySessionToServer()
        playSessionPeakSec.value = 0
        audio.value.currentTime = 0
        syncUserVolumeToAudio()
        void audio.value.play()
        return
      }
      void next()
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
        if (document.visibilityState !== 'visible') syncUserVolumeToAudio()
      })
    }
  }

  const loadTrack = () => {
    const track = currentTrack.value
    if (!track?.id) return

    const streamUrl = `${auth.serverUrl}/api/stream/${track.id}?token=${auth.token}`
    const playingId = streamTrackIdFromAudioSrc(audio.value.src)
    const sameStream = playingId != null && String(playingId) === String(track.id)

    if (!sameStream) {
      playSessionPeakSec.value = 0
      audio.value.src = streamUrl
      audio.value.load()
    }
    playSessionTrackId.value = track.id
    syncUserVolumeToAudio()
  }

  const play = async () => {
    if (audio.value.src) await audio.value.play()
  }
  const pause = () => audio.value.pause()
  const togglePlay = () => (isPlaying.value ? pause() : play())
  const toggleShuffle = () => (isShuffle.value = !isShuffle.value)
  const toggleRepeat = () => {
    const modes = ['off', 'all', 'one']
    repeatMode.value = modes[(modes.indexOf(repeatMode.value) + 1) % modes.length]
  }

  const next = async () => {
    flushPlaySessionToServer()
    if (queue.value.length === 0) return
    if (isShuffle.value) {
      currentIndex.value = Math.floor(Math.random() * queue.value.length)
    } else {
      if (currentIndex.value === queue.value.length - 1) {
        if (repeatMode.value === 'all') currentIndex.value = 0
        else {
          pause()
          return
        }
      } else currentIndex.value++
    }
    loadTrack()
    play()
  }

  const prev = async () => {
    if (currentTime.value > 3) {
      audio.value.currentTime = 0
      return
    }
    flushPlaySessionToServer()
    currentIndex.value = currentIndex.value <= 0 ? queue.value.length - 1 : currentIndex.value - 1
    loadTrack()
    play()
  }

  const playNewQueue = async (newQueue, startIndex = 0) => {
    flushPlaySessionToServer()
    queue.value = [...newQueue]
    currentIndex.value = startIndex
    loadTrack()
    play()
  }

  const playAlbum = async (albumTracks, startTrackId = null, shuffle = false) => {
    flushPlaySessionToServer()
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
    loadTrack()
    play()
  }

  const playList = async (tracks, startIndex) => {
    flushPlaySessionToServer()
    queue.value = [...tracks]
    currentIndex.value = startIndex
    loadTrack()
    play()
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
    const libTracks = await library.getTracks()
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
    loadTrack()
    pause()
    return true
  }

  const resumePersistedQueueAndPlay = async () => {
    const ok = await restoreQueueFromStorage()
    if (ok) await play()
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
    playAlbum,
    playList,
    restoreQueueFromStorage,
    hasPersistedQueueSnapshot,
    resumePersistedQueueAndPlay,
    beginPersistingQueue,
    getPersistedQueueResumeHint,
  }
})
