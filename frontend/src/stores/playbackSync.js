import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useAuthStore } from './auth'
import { usePlayerStore } from './player'
import { useLibraryStore } from './library'
import { resolveNextIndex, resolvePrevIndex, trackSummaryAt } from '@/lib/playbackSyncUtils.js'

const DEVICE_STORAGE_KEY = 'lazidrome.device.v1'
const STATE_PUSH_MS = 2500
const RECONNECT_MS = 3500

function emptyRemoteState() {
  return {
    trackIds: [],
    currentIndex: -1,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    isShuffle: false,
    repeatMode: 'off',
    track: null,
  }
}

function readDeviceId() {
  if (typeof localStorage === 'undefined') return crypto.randomUUID()
  try {
    const raw = localStorage.getItem(DEVICE_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.id) return String(parsed.id)
    }
  } catch {
    /* ignore */
  }
  const id = crypto.randomUUID()
  try {
    localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify({ id }))
  } catch {
    /* ignore */
  }
  return id
}

function guessDeviceName() {
  if (typeof navigator === 'undefined') return 'Browser'
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return 'Android'
  if (/Mac OS X/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'Windows'
  if (/Linux/.test(ua)) return 'Linux'
  return 'Browser'
}

function buildWsUrl(serverUrl, token) {
  const origin =
    serverUrl?.replace(/\/$/, '') ||
    (typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:5294')
  const wsOrigin = origin.replace(/^http/i, (m) => (m.toLowerCase() === 'https' ? 'wss' : 'ws'))
  return `${wsOrigin}/api/playback/ws?token=${encodeURIComponent(token)}`
}

export const usePlaybackSyncStore = defineStore('playbackSync', () => {
  const auth = useAuthStore()
  const player = usePlayerStore()
  const library = useLibraryStore()

  const deviceId = ref(readDeviceId())
  const deviceName = ref(guessDeviceName())
  const connected = ref(false)
  const masterDeviceId = ref(null)
  const masterDeviceName = ref(null)
  const remoteState = ref(emptyRemoteState())
  const connectedDevices = ref([])

  let ws = null
  let reconnectTimer = null
  let statePushTimer = null
  let applyingRemoteCommand = false
  let started = false

  const isMaster = computed(() => !!masterDeviceId.value && masterDeviceId.value === deviceId.value)

  function shouldControlRemote() {
    return connected.value && !!masterDeviceId.value && masterDeviceId.value !== deviceId.value
  }

  const isRemoteMode = computed(() => {
    if (!connected.value || !masterDeviceId.value) return false
    if (isMaster.value) return false
    return !!(remoteState.value.track?.id || remoteState.value.trackIds.length)
  })

  const displayTrack = computed(() => {
    if (isRemoteMode.value) return remoteState.value.track
    return player.currentTrack
  })

  const displayIsPlaying = computed(() =>
    isRemoteMode.value ? remoteState.value.isPlaying : player.isPlaying,
  )

  const displayProgress = computed(() => {
    if (isRemoteMode.value) {
      const d = remoteState.value.duration
      const t = remoteState.value.currentTime
      return d > 0 ? (t / d) * 100 : 0
    }
    return player.progress[0]
  })

  const remoteQueueCount = computed(() => {
    const ids = remoteState.value.trackIds
    if (!ids.length) return 0
    const idx = Math.max(0, remoteState.value.currentIndex)
    return Math.max(0, ids.length - idx - 1)
  })

  function clearReconnectTimer() {
    if (reconnectTimer != null) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  function scheduleReconnect() {
    if (!auth.token || !started) return
    clearReconnectTimer()
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, RECONNECT_MS)
  }

  function send(payload) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify(payload))
  }

  function buildPlayerStatePayload() {
    const tr = player.currentTrack
    return {
      trackIds: player.queue.map((track) => (track?.id != null ? String(track.id) : '')).filter(Boolean),
      currentIndex: player.currentIndex,
      isPlaying: player.isPlaying,
      currentTime: player.currentTime,
      duration: player.duration,
      isShuffle: player.isShuffle,
      repeatMode: player.repeatMode,
      track: tr?.id
        ? {
            id: String(tr.id),
            title: String(tr.title || ''),
            artist: String(tr.artist || ''),
            album: String(tr.album || ''),
          }
        : null,
    }
  }

  function pushStateNow() {
    if (!connected.value || !auth.token) return
    if (!player.currentTrack?.id && !player.queue.length) return
    send({ type: 'state', state: buildPlayerStatePayload() })
  }

  function scheduleStatePush() {
    if (!isMaster.value && masterDeviceId.value && masterDeviceId.value !== deviceId.value) return
    if (!player.currentTrack?.id && !player.queue.length) return
    if (statePushTimer != null) return
    statePushTimer = setTimeout(() => {
      statePushTimer = null
      pushStateNow()
    }, STATE_PUSH_MS)
  }

  function claimMaster() {
    send({ type: 'claim_master' })
    pushStateNow()
  }

  async function applyRemoteCommand(command, payload = {}) {
    applyingRemoteCommand = true
    try {
      switch (command) {
        case 'play':
          if (!player.currentTrack?.id && player.queue.length) {
            player.currentIndex = Math.max(0, player.currentIndex)
          }
          await player.startPlayback()
          break
        case 'pause':
          player.pause()
          break
        case 'togglePlay':
          await player.togglePlay()
          break
        case 'next':
          await player.next()
          break
        case 'prev':
          if (player.currentTime > 3) {
            player.progress = [0]
          } else {
            await player.prev()
          }
          break
        case 'seek': {
          const pos = Number(payload.position)
          if (Number.isFinite(pos) && pos >= 0 && player.duration > 0) {
            player.progress = [(pos / player.duration) * 100]
          }
          break
        }
        case 'playAtIndex': {
          const index = Number(payload.index)
          if (Number.isFinite(index) && index >= 0 && index < player.queue.length) {
            player.currentIndex = index
            await player.startPlayback()
          }
          break
        }
        case 'toggleShuffle':
          player.toggleShuffle()
          break
        case 'toggleRepeat':
          player.toggleRepeat()
          break
        case 'playQueue': {
          const rawIds = payload.trackIds
          const startIndex = Number(payload.startIndex) || 0
          if (!Array.isArray(rawIds) || !rawIds.length) break
          const trackIds = rawIds.map((id) => String(id)).filter(Boolean)
          const tracks = await library.fetchTracksByIds(trackIds)
          const byId = new Map(tracks.map((t) => [String(t.id), t]))
          const resolved = trackIds.map((id) => byId.get(id)).filter(Boolean)
          if (!resolved.length) break
          await player.playNewQueue(resolved, Math.min(Math.max(0, startIndex), resolved.length - 1))
          break
        }
        default:
          break
      }
      pushStateNow()
    } finally {
      applyingRemoteCommand = false
    }
  }

  function handleMessage(raw) {
    let msg
    try {
      msg = JSON.parse(raw)
    } catch {
      return
    }

    switch (msg.type) {
      case 'session': {
        masterDeviceId.value = msg.masterDeviceId || null
        masterDeviceName.value = msg.masterDeviceName || null
        if (msg.state && typeof msg.state === 'object') {
          remoteState.value = { ...emptyRemoteState(), ...msg.state }
        }
        if (Array.isArray(msg.devices)) {
          connectedDevices.value = msg.devices
        }
        break
      }
      case 'state': {
        masterDeviceId.value = msg.masterDeviceId || masterDeviceId.value
        masterDeviceName.value = msg.masterDeviceName || masterDeviceName.value
        if (msg.state && typeof msg.state === 'object') {
          remoteState.value = { ...emptyRemoteState(), ...msg.state }
        }
        break
      }
      case 'master_changed': {
        const nextMaster = msg.masterDeviceId || null
        masterDeviceId.value = nextMaster
        masterDeviceName.value = msg.masterDeviceName || null
        if (!nextMaster) {
          remoteState.value = emptyRemoteState()
        }
        if (nextMaster && nextMaster !== deviceId.value && player.isPlaying && !applyingRemoteCommand) {
          player.pause()
        }
        break
      }
      case 'devices': {
        if (Array.isArray(msg.devices)) {
          connectedDevices.value = msg.devices
        }
        break
      }
      case 'command': {
        if (masterDeviceId.value !== deviceId.value) return
        const command = String(msg.command || '')
        const payload = msg.payload && typeof msg.payload === 'object' ? msg.payload : {}
        void applyRemoteCommand(command, payload)
        break
      }
      default:
        break
    }
  }

  function connect() {
    if (!auth.token || typeof WebSocket === 'undefined') return
    disconnect(false)

    const url = buildWsUrl(auth.serverUrl, auth.token)
    const socket = new WebSocket(url)
    ws = socket

    socket.addEventListener('open', () => {
      connected.value = true
      clearReconnectTimer()
      send({
        type: 'hello',
        deviceId: deviceId.value,
        deviceName: deviceName.value,
        claimMaster: !!(player.isPlaying && player.currentTrack?.id),
      })
      if (player.isPlaying && player.currentTrack?.id) {
        pushStateNow()
      }
    })

    socket.addEventListener('message', (ev) => {
      if (typeof ev.data === 'string') handleMessage(ev.data)
    })

    socket.addEventListener('close', () => {
      connected.value = false
      ws = null
      scheduleReconnect()
    })

    socket.addEventListener('error', () => {
      connected.value = false
    })
  }

  function disconnect(stopAutoReconnect = true) {
    if (stopAutoReconnect) {
      started = false
      clearReconnectTimer()
    }
    if (statePushTimer != null) {
      clearTimeout(statePushTimer)
      statePushTimer = null
    }
    if (ws) {
      try {
        ws.close()
      } catch {
        /* ignore */
      }
      ws = null
    }
    connected.value = false
  }

  function start() {
    if (started) return
    started = true
    connect()
  }

  function stop() {
    disconnect(true)
    masterDeviceId.value = null
    masterDeviceName.value = null
    remoteState.value = emptyRemoteState()
    connectedDevices.value = []
  }

  function optimisticApply(command, payload = {}) {
    if (!isRemoteMode.value) return
    const s = { ...remoteState.value, trackIds: [...(remoteState.value.trackIds || [])] }
    switch (command) {
      case 'togglePlay':
        s.isPlaying = !s.isPlaying
        break
      case 'next': {
        const ni = resolveNextIndex(s)
        if (ni == null) {
          s.isPlaying = false
        } else {
          s.currentIndex = ni
          s.currentTime = 0
          s.track = trackSummaryAt(s, [], ni)
        }
        break
      }
      case 'prev': {
        const pos = Number(payload.position)
        if (Number.isFinite(pos) && pos >= 0 && s.duration > 0 && s.currentTime > 3) {
          s.currentTime = 0
        } else {
          const pi = resolvePrevIndex(s)
          if (pi != null) {
            s.currentIndex = pi
            s.currentTime = 0
            s.track = trackSummaryAt(s, [], pi)
          }
        }
        break
      }
      case 'seek': {
        const pos = Number(payload.position)
        if (Number.isFinite(pos) && pos >= 0) s.currentTime = pos
        break
      }
      case 'playAtIndex': {
        const index = Number(payload.index)
        if (Number.isFinite(index) && index >= 0 && index < s.trackIds.length) {
          s.currentIndex = index
          s.currentTime = 0
          s.isPlaying = true
          s.track = trackSummaryAt(s, [], index)
        }
        break
      }
      case 'toggleShuffle':
        s.isShuffle = !s.isShuffle
        break
      case 'toggleRepeat': {
        const modes = ['off', 'all', 'one']
        s.repeatMode = modes[(modes.indexOf(s.repeatMode) + 1) % modes.length]
        break
      }
      case 'playQueue': {
        const rawIds = payload.trackIds
        const startIndex = Number(payload.startIndex) || 0
        if (!Array.isArray(rawIds) || !rawIds.length) break
        s.trackIds = rawIds.map((id) => String(id)).filter(Boolean)
        s.currentIndex = Math.min(Math.max(0, startIndex), s.trackIds.length - 1)
        s.currentTime = 0
        s.isPlaying = true
        s.track = trackSummaryAt(s, [], s.currentIndex)
        break
      }
      default:
        return
    }
    remoteState.value = s
  }

  function sendCommand(command, payload = {}, { optimistic = true } = {}) {
    if (optimistic) optimisticApply(command, payload)
    send({ type: 'command', command, payload })
  }

  async function playTracks(tracks, startIndex = 0) {
    if (!Array.isArray(tracks) || !tracks.length) return
    const idx = Math.max(0, Math.min(Number(startIndex) || 0, tracks.length - 1))

    if (shouldControlRemote()) {
      const trackIds = tracks.map((t) => (t?.id != null ? String(t.id) : '')).filter(Boolean)
      if (!trackIds.length) return
      sendCommand('playQueue', { trackIds, startIndex: idx })
      return
    }

    await player.playNewQueue(tracks, idx)
    if (connected.value && player.currentTrack?.id) {
      claimMaster()
      pushStateNow()
    }
  }

  async function remoteTogglePlay() {
    if (shouldControlRemote()) {
      sendCommand('togglePlay')
      return
    }
    if (player.currentTrack?.id) claimMaster()
    await player.togglePlay()
    pushStateNow()
  }

  async function remoteNext() {
    if (shouldControlRemote()) {
      sendCommand('next')
      return
    }
    if (player.currentTrack?.id) claimMaster()
    await player.next()
    pushStateNow()
  }

  async function remotePrev() {
    if (shouldControlRemote()) {
      sendCommand('prev', { position: remoteState.value.currentTime })
      return
    }
    if (player.currentTrack?.id) claimMaster()
    await player.prev()
    pushStateNow()
  }

  function remoteSeek(positionSec) {
    const pos = Number(positionSec)
    if (!Number.isFinite(pos) || pos < 0) return
    if (shouldControlRemote()) {
      sendCommand('seek', { position: pos })
      return
    }
    if (player.duration > 0) {
      player.progress = [(pos / player.duration) * 100]
      pushStateNow()
    }
  }

  function remotePlayAtIndex(index) {
    const idx = Number(index)
    if (!Number.isFinite(idx) || idx < 0) return
    if (shouldControlRemote()) {
      sendCommand('playAtIndex', { index: idx })
      return
    }
    player.currentIndex = idx
    void player.startPlayback().then(() => pushStateNow())
  }

  function remoteToggleShuffle() {
    if (shouldControlRemote()) {
      sendCommand('toggleShuffle')
      return
    }
    player.toggleShuffle()
    pushStateNow()
  }

  function remoteToggleRepeat() {
    if (shouldControlRemote()) {
      sendCommand('toggleRepeat')
      return
    }
    player.toggleRepeat()
    pushStateNow()
  }

  async function transferPlaybackHere() {
    if (!isRemoteMode.value) return false
    const ids = remoteState.value.trackIds
    if (!ids?.length) return false

    const idx = Math.max(0, Number(remoteState.value.currentIndex) || 0)
    const tracks = await library.fetchTracksByIds(ids)
    const byId = new Map(tracks.map((t) => [String(t.id), t]))
    const resolved = ids.map((id) => byId.get(String(id))).filter(Boolean)
    if (!resolved.length) return false

    claimMaster()
    await player.playNewQueue(resolved, Math.min(idx, resolved.length - 1))
    pushStateNow()
    return true
  }

  watch(
    () => auth.token,
    (token, prev) => {
      if (token && !prev) start()
      if (!token && prev) stop()
    },
  )

  watch(
    () => player.isPlaying,
    (playing, was) => {
      if (applyingRemoteCommand || !connected.value) return
      if (shouldControlRemote()) return
      if (playing && !was && player.currentTrack?.id) {
        claimMaster()
        pushStateNow()
      }
    },
  )

  watch(
    [
      () => player.queue.length,
      () => player.currentIndex,
      () => player.isShuffle,
      () => player.repeatMode,
      () => player.currentTrack?.id,
    ],
    () => {
      if (applyingRemoteCommand || !connected.value) return
      if (!player.currentTrack?.id && !player.queue.length) return
      if (isMaster.value || !masterDeviceId.value) {
        pushStateNow()
      }
    },
  )

  watch(
    () => player.currentTime,
    () => {
      if (applyingRemoteCommand || !connected.value) return
      if (!isMaster.value && masterDeviceId.value) return
      scheduleStatePush()
    },
  )

  return {
    deviceId,
    deviceName,
    connected,
    masterDeviceId,
    masterDeviceName,
    remoteState,
    connectedDevices,
    isMaster,
    isRemoteMode,
    displayTrack,
    displayIsPlaying,
    displayProgress,
    remoteQueueCount,
    start,
    stop,
    connect,
    claimMaster,
    pushStateNow,
    sendCommand,
    remoteTogglePlay,
    remoteNext,
    remotePrev,
    remoteSeek,
    remotePlayAtIndex,
    remoteToggleShuffle,
    remoteToggleRepeat,
    transferPlaybackHere,
    playTracks,
    shouldControlRemote,
  }
})
