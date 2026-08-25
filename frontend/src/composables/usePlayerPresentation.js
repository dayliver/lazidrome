import { computed, ref, watch } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { usePlaybackSyncStore } from '@/stores/playbackSync.js'
import { useAuthStore } from '@/stores/auth'
import { useLibraryStore } from '@/stores/library'

export function usePlayerPresentation() {
  const player = usePlayerStore()
  const sync = usePlaybackSyncStore()
  const auth = useAuthStore()
  const library = useLibraryStore()

  const remoteQueueTracks = ref([])
  const remoteQueueLoading = ref(false)
  let fetchGen = 0

  const isRemote = computed(() => sync.isRemoteMode)

  const currentTrack = computed(() => sync.displayTrack)

  const coverUrl = computed(() => {
    const id = currentTrack.value?.id
    if (!id) return ''
    return auth.coverSrc('track', id)
  })

  const isPlaying = computed(() => sync.displayIsPlaying)

  // 원격은 보간된 위치를 쓴다 — 마스터 state가 2.5초마다만 오기 때문
  const currentTime = computed(() =>
    isRemote.value ? sync.remotePositionSec : player.currentTime,
  )

  const duration = computed(() =>
    isRemote.value ? sync.remoteState.duration : player.duration,
  )

  const isShuffle = computed(() =>
    isRemote.value ? sync.remoteState.isShuffle : player.isShuffle,
  )

  const repeatMode = computed(() =>
    isRemote.value ? sync.remoteState.repeatMode : player.repeatMode,
  )

  const currentIndex = computed(() =>
    isRemote.value ? sync.remoteState.currentIndex : player.currentIndex,
  )

  const displayQueue = computed(() =>
    isRemote.value ? remoteQueueTracks.value : player.queue,
  )

  const progress = computed({
    get: () => [sync.displayProgress],
    set: (val) => {
      const pct = Array.isArray(val) ? val[0] : val
      const d = duration.value
      if (!Number.isFinite(pct) || d <= 0) return
      sync.remoteSeek((pct / 100) * d)
    },
  })

  const remoteBadge = computed(() => sync.masterDeviceName || '')

  const canEditTrackMeta = computed(() => !isRemote.value && !!currentTrack.value?.id)

  async function loadRemoteQueue(ids) {
    if (!ids?.length) {
      remoteQueueTracks.value = []
      return
    }
    const gen = ++fetchGen
    remoteQueueLoading.value = true
    try {
      const tracks = await library.fetchTracksByIds(ids)
      if (gen !== fetchGen) return
      const byId = new Map(tracks.map((t) => [String(t.id), t]))
      remoteQueueTracks.value = ids.map((id) => byId.get(String(id))).filter(Boolean)
    } catch {
      if (gen === fetchGen) remoteQueueTracks.value = []
    } finally {
      if (gen === fetchGen) remoteQueueLoading.value = false
    }
  }

  watch(
    () => (sync.isRemoteMode ? sync.remoteState.trackIds.join(',') : ''),
    (key) => {
      if (!sync.isRemoteMode) {
        remoteQueueTracks.value = []
        return
      }
      const ids = sync.remoteState.trackIds
      if (key && ids.length) void loadRemoteQueue(ids)
    },
    { immediate: true },
  )

  return {
    player,
    sync,
    library,
    isRemote,
    currentTrack,
    coverUrl,
    isPlaying,
    currentTime,
    duration,
    isShuffle,
    repeatMode,
    currentIndex,
    displayQueue,
    progress,
    remoteBadge,
    remoteQueueLoading,
    canEditTrackMeta,
    connected: computed(() => sync.connected),
    connectedDevices: computed(() => sync.connectedDevices),
    localDeviceId: computed(() => sync.deviceId),
    localDeviceName: computed(() => sync.deviceName),
    isMaster: computed(() => sync.isMaster),
    isQueueView: computed(() => player.isQueueView),
    togglePlay: () => sync.remoteTogglePlay(),
    next: () => sync.remoteNext(),
    prev: () => sync.remotePrev(),
    toggleShuffle: () => sync.remoteToggleShuffle(),
    toggleRepeat: () => sync.remoteToggleRepeat(),
    playAtIndex: (index) => sync.remotePlayAtIndex(index),
    transferPlaybackHere: () => sync.transferPlaybackHere(),
    toggleExpand: () => player.toggleExpand(),
    toggleQueueView: () => player.toggleQueueView(),
  }
}
