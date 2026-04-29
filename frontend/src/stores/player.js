import { defineStore } from 'pinia'
import { ref, computed, shallowRef } from 'vue'
import { useAuthStore } from './auth'
import { useLibraryStore } from './library'

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

  const isExpanded = ref(false)    // 전체 화면 플레이어 열림 여부
  const isQueueView = ref(false)   // 전체 화면 내에서 대기열 표시 여부

  /** 현재 세션에서 이 트랙에 도달한 최대 재생 위치(초) — 50% 이상이면 재생 횟수 반영 */
  const playSessionTrackId = ref(null)
  const playSessionPeakSec = ref(0)

  // --- 게터 (Getters) ---
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
    }
  })

  // --- 액션 (Actions) ---
  const toggleExpand = () => {
    isExpanded.value = !isExpanded.value
    if (!isExpanded.value) isQueueView.value = false
  }

  const toggleQueueView = () => {
    isQueueView.value = !isQueueView.value
  }

  const finalizeCurrentTrackPlay = async () => {
    if (!auth.token) return
    const idx = currentIndex.value
    if (idx < 0 || idx >= queue.value.length) return
    const tr = queue.value[idx]
    if (!tr?.id || playSessionTrackId.value == null) return
    if (String(playSessionTrackId.value) !== String(tr.id)) return
    const peakSnapshot = playSessionPeakSec.value
    await library.recordTrackPlay(tr.id, peakSnapshot)
  }

  const bumpPlaySessionPeak = () => {
    const tr = currentTrack.value
    if (!tr?.id || playSessionTrackId.value == null) return
    if (String(tr.id) !== String(playSessionTrackId.value)) return
    const t = audio.value.currentTime
    if (!Number.isFinite(t) || t < 0) return
    playSessionPeakSec.value = Math.max(playSessionPeakSec.value, t)
  }

  const initAudio = () => {
    if (audioListenersBound) return
    audioListenersBound = true
    audio.value.volume = volume.value / 100
    audio.value.addEventListener('timeupdate', () => {
      currentTime.value = audio.value.currentTime
      bumpPlaySessionPeak()
    })
    audio.value.addEventListener('seeked', bumpPlaySessionPeak)
    audio.value.addEventListener('loadedmetadata', () => {
      duration.value = audio.value.duration
      bumpPlaySessionPeak()
    })
    audio.value.addEventListener('ended', async () => {
      if (repeatMode.value === 'one') {
        await finalizeCurrentTrackPlay()
        playSessionPeakSec.value = 0
        audio.value.currentTime = 0
        audio.value.play()
        return
      }
      await next()
    })
    audio.value.addEventListener('play', () => isPlaying.value = true)
    audio.value.addEventListener('pause', () => isPlaying.value = false)
  }

  /**
   * 💉 수술 핵심: 음원 로드 로직 변경
   */
  const loadTrack = () => {
    const track = currentTrack.value
    if (!track?.id) return

    // 💡 <audio> 태그는 커스텀 헤더를 못 쓰므로 token 쿼리로 스트림 인증
    const streamUrl = `${auth.serverUrl}/api/stream/${track.id}?token=${auth.token}`
    const playingId = streamTrackIdFromAudioSrc(audio.value.src)
    const sameStream = playingId != null && String(playingId) === String(track.id)

    if (!sameStream) {
      playSessionPeakSec.value = 0
      audio.value.src = streamUrl
      audio.value.load()
    }
    playSessionTrackId.value = track.id
  }

  const play = async () => { if (audio.value.src) await audio.value.play() }
  const pause = () => audio.value.pause()
  const togglePlay = () => isPlaying.value ? pause() : play()
  const toggleShuffle = () => isShuffle.value = !isShuffle.value
  const toggleRepeat = () => {
    const modes = ['off', 'all', 'one']
    repeatMode.value = modes[(modes.indexOf(repeatMode.value) + 1) % modes.length]
  }

  const next = async () => {
    await finalizeCurrentTrackPlay()
    if (queue.value.length === 0) return
    if (isShuffle.value) {
      currentIndex.value = Math.floor(Math.random() * queue.value.length)
    } else {
      if (currentIndex.value === queue.value.length - 1) {
        if (repeatMode.value === 'all') currentIndex.value = 0
        else { pause(); return }
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
    await finalizeCurrentTrackPlay()
    currentIndex.value = currentIndex.value <= 0 ? queue.value.length - 1 : currentIndex.value - 1
    loadTrack()
    play()
  }

  const playNewQueue = async (newQueue, startIndex = 0) => {
    await finalizeCurrentTrackPlay()
    queue.value = [...newQueue]
    currentIndex.value = startIndex
    loadTrack()
    play()
  }

  const playAlbum = async (albumTracks, startTrackId = null, shuffle = false) => {
    await finalizeCurrentTrackPlay()
    let newQueue = [...albumTracks]
    if (shuffle) {
      for (let i = newQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newQueue[i], newQueue[j]] = [newQueue[j], newQueue[i]]
      }
    }
    if (startTrackId) {
      const targetIndex = newQueue.findIndex(t => t.id === startTrackId)
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
    await finalizeCurrentTrackPlay()
    queue.value = [...tracks]
    currentIndex.value = startIndex
    loadTrack()
    play()
  }

  return {
    queue, currentIndex, isPlaying, volume, currentTime, duration, isShuffle, repeatMode, 
    isExpanded, isQueueView, currentTrack, progress,
    initAudio, play, pause, togglePlay, next, prev, playNewQueue, toggleShuffle, toggleRepeat,
    toggleExpand, toggleQueueView, loadTrack, playAlbum, playList
  }
})