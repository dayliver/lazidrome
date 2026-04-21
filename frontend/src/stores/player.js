import { defineStore } from 'pinia'
import { ref, computed, shallowRef } from 'vue'
import { useAuthStore } from './auth'

export const usePlayerStore = defineStore('player', () => {
  const auth = useAuthStore()
  const _audio = new Audio()
  _audio.crossOrigin = 'anonymous'
  const audio = shallowRef(_audio)
  
  // --- 상태 (State) ---
  const queue = ref([])
  const currentIndex = ref(-1)
  const isPlaying = ref(false)
  const volume = ref(50)
  const currentTime = ref(0)
  const duration = ref(0)
  const isShuffle = ref(false)
  const repeatMode = ref('off') 

  const isExpanded = ref(false)    // 전체 화면 플레이어 열림 여부
  const isQueueView = ref(false)   // 전체 화면 내에서 대기열 표시 여부

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

  const initAudio = () => {
    audio.value.volume = volume.value / 100
    audio.value.addEventListener('timeupdate', () => currentTime.value = audio.value.currentTime)
    audio.value.addEventListener('loadedmetadata', () => duration.value = audio.value.duration)
    audio.value.addEventListener('ended', () => {
      if (repeatMode.value === 'one') {
        audio.value.currentTime = 0
        audio.value.play()
      } else next()
    })
    audio.value.addEventListener('play', () => isPlaying.value = true)
    audio.value.addEventListener('pause', () => isPlaying.value = false)
  }

  /**
   * 💉 수술 핵심: 음원 로드 로직 변경
   */
  const loadTrack = () => {
    const track = currentTrack.value
    if (!track) return

    // 1. md5 해싱 및 Subsonic 전용 쿼리 파라미터 완전 삭제
    // 2. Lazidrome 전용 스트리밍 API 경로로 교체
    // 💡 <audio> 태그는 커스텀 헤더를 보낼 수 없으므로, 
    // 보안을 위해 토큰을 쿼리 스트링으로 전달합니다.
    const streamUrl = `${auth.serverUrl}/api/stream/${track.id}?token=${auth.token}`
    
    if (audio.value.src !== streamUrl) {
      audio.value.src = streamUrl
      audio.value.load()
    }
  }

  const play = async () => { if (audio.value.src) await audio.value.play() }
  const pause = () => audio.value.pause()
  const togglePlay = () => isPlaying.value ? pause() : play()
  const toggleShuffle = () => isShuffle.value = !isShuffle.value
  const toggleRepeat = () => {
    const modes = ['off', 'all', 'one']
    repeatMode.value = modes[(modes.indexOf(repeatMode.value) + 1) % modes.length]
  }

  const next = () => {
    if (queue.value.length === 0) return
    if (isShuffle.value) {
      currentIndex.value = Math.floor(Math.random() * queue.value.length)
    } else {
      if (currentIndex.value === queue.value.length - 1) {
        if (repeatMode.value === 'all') currentIndex.value = 0
        else { pause(); return }
      } else currentIndex.value++
    }
    loadTrack(); play()
  }

  const prev = () => {
    if (currentTime.value > 3) { audio.value.currentTime = 0; return }
    currentIndex.value = currentIndex.value <= 0 ? queue.value.length - 1 : currentIndex.value - 1
    loadTrack(); play()
  }

  const playNewQueue = (newQueue, startIndex = 0) => {
    queue.value = [...newQueue]
    currentIndex.value = startIndex
    loadTrack(); play()
  }

  const playAlbum = (albumTracks, startTrackId = null, shuffle = false) => {
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

  const playList = (tracks, startIndex) => {
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