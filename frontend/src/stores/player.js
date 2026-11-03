import { defineStore } from 'pinia'
import { ref, computed, shallowRef, watch } from 'vue'
import { t } from '@/i18n/t'
import { useAuthStore } from './auth'
import { useLibraryStore } from './library'
import {
  QueueHlsPlayer,
  isAndroidPlaybackUa,
  isMobilePlaybackUa,
  prefetchHlsModule,
  shouldPreferContinuousQueue,
  shouldPreferHlsQueue,
} from '@/lib/queueHlsPlayer.js'
import {
  MIN_LOOP_REGION_SEC,
  normalizePlaybackRate,
  nudgePlaybackRate as nudgeRate,
  shouldJumpLoopRegion,
  isValidLoopRegion,
} from '@/lib/playbackAdjust.js'

const FADE_BEFORE_END_SEC = 5
/** 다음 곡 URL을 미리 받아 둘 시점(끝나기 N초 전) */
const PRELOAD_LEAD_SEC = 45
/**
 * 화면 꺼짐 시 JS가 멈추기 전에 다음 곡을 이미 재생 중이어야 한다.
 * 끝 페이드 구간 안에서 standby를 play()하고 main을 교체한다.
 */
const EARLY_HANDOFF_LEAD_SEC = 2
/** 재생 시작 시 현재 곡 포함 앞으로 N곡 URL·서명 선캐시 (백그라운드 ended 대비) */
const AGGRESSIVE_PREFETCH_AHEAD = 20
/** Continuous ffmpeg concat: keep slices short so the pipe starts before screen-off. */
const CONTINUOUS_SLICE_TRACKS = 12
/** Next continuous pipe URL/timeline — prepare this many seconds before slice end. */
const CONTINUOUS_SLICE_PREPARE_LEAD_SEC = 45
/**
 * When the tab/app is hidden, commit the next continuous src before `ended`
 * (clips a little of the last track) so play() still runs under an active session.
 */
const CONTINUOUS_SLICE_BG_COMMIT_LEAD_SEC = 2.5
const QUEUE_STORAGE_KEY = 'lazidrome.queue.v1'
const PLAYBACK_RATE_STORAGE_KEY = 'lazidrome.playbackRate'

function loadPersistedPlaybackRate() {
  if (typeof localStorage === 'undefined') return 1
  try {
    const raw = localStorage.getItem(PLAYBACK_RATE_STORAGE_KEY)
    if (raw == null || raw === '') return 1
    return normalizePlaybackRate(raw)
  } catch {
    return 1
  }
}

function persistPlaybackRate(rate) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(PLAYBACK_RATE_STORAGE_KEY, String(rate))
  } catch {
    /* quota */
  }
}

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
/** 엘리먼트 교체 handoff 중 pause/play로 isPlaying·MediaSession이 흔들리지 않게 */
let suppressPlayStateEvents = false
let preloadedNextId = null
/** 이번 곡에서 early handoff를 이미 수행했는지 */
let earlyHandoffDone = false
let playRetryTimer = null
/** play() 거부 후에도 화면 복귀 시 재시도할지 (pause·성공 재생 전까지 유지) */
let playRetryActive = false
/** trackId → 전체 스트림 URL (서명 포함). 백그라운드 곡 전환 시 await 없이 src 교체 */
const streamUrlByTrackId = new Map()
let queueHlsPlayer = null
let hlsQueueMode = false
/** Server-concatenated MP3 pipe (Android continuous stream). Shares timeline math with HLS. */
let continuousQueueMode = false
let lastHlsTrackIndex = -1
let hlsSliceBaseIndex = 0
let hlsSegmentStarts = []
let hlsSegmentDurations = []
/**
 * Next continuous (or final single-track) window, prepared before the current pipe ends.
 * Commit must stay sync — no await — for Android background.
 * @type {null | {
 *   kind: 'continuous',
 *   fromIndex: number,
 *   ids: string[],
 *   url: string,
 *   segmentStarts: number[],
 *   segmentDurations: number[],
 * } | {
 *   kind: 'direct',
 *   index: number,
 *   trackId: string,
 *   url: string,
 * }}
 */
let pendingContinuousSlice = null

const inQueueTimeline = () => hlsQueueMode || continuousQueueMode

const isPlaybackBackgrounded = () =>
  typeof document !== 'undefined' && document.visibilityState !== 'visible'

function mountAudioElement(el) {
  if (typeof document === 'undefined' || !el || el.isConnected) return
  el.setAttribute('aria-hidden', 'true')
  el.style.cssText = 'display:none;position:fixed;width:0;height:0;opacity:0;pointer-events:none'
  const parent = document.body || document.documentElement
  parent?.appendChild(el)
}

function createAudioElement({ preload = false } = {}) {
  const el = new Audio()
  el.crossOrigin = 'anonymous'
  if (preload) el.preload = 'auto'
  el.setAttribute('playsinline', '')
  el.setAttribute('webkit-playsinline', '')
  // Android Chrome: DOM에 붙은 audio가 MediaSession·백그라운드 포커스에 더 안정적
  if (typeof document !== 'undefined') {
    if (document.body) mountAudioElement(el)
    else document.addEventListener('DOMContentLoaded', () => mountAudioElement(el), { once: true })
  }
  return el
}

export const usePlayerStore = defineStore('player', () => {
  const auth = useAuthStore()
  const library = useLibraryStore()

  const audio = shallowRef(createAudioElement())
  /** 다음 곡을 버퍼링·early handoff에 쓰는 대기 엘리먼트 (교체 후 역할이 바뀜) */
  let standbyAudio = createAudioElement({ preload: true })

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
  const playbackRate = ref(loadPersistedPlaybackRate())
  const loopRegionEnabled = ref(false)
  const loopStartSec = ref(0)
  const loopEndSec = ref(0)

  const isExpanded = ref(false)
  const isQueueView = ref(false)

  /** 현재 세션에서 이 트랙에 도달한 최대 재생 위치(초) — 50% 이상이면 재생 횟수 반영 */
  const playSessionTrackId = ref(null)
  const playSessionPeakSec = ref(0)

  const userVolumeLinear = () => Math.max(0, Math.min(1, volume.value / 100))

  const trackVolumeFactor = () => {
    const raw = currentTrack.value?.volume_pct
    const n = raw == null || raw === '' ? 100 : Number(raw)
    if (!Number.isFinite(n)) return 1
    return Math.min(150, Math.max(50, n)) / 100
  }

  /** 기기 마스터 × 트랙 게인 (페이드 전). HTMLAudio max 1.0이므로 clamp. */
  const effectiveVolumeLinear = () =>
    Math.min(1, Math.max(0, userVolumeLinear() * trackVolumeFactor()))

  const syncUserVolumeToAudio = () => {
    audio.value.volume = effectiveVolumeLinear()
  }

  const syncPlaybackRateToAudio = () => {
    const rate = normalizePlaybackRate(playbackRate.value)
    playbackRate.value = rate
    audio.value.playbackRate = rate
    standbyAudio.playbackRate = rate
  }

  const clearLoopRegion = () => {
    loopRegionEnabled.value = false
    loopStartSec.value = 0
    loopEndSec.value = 0
  }

  const seekToLocalSeconds = (targetSec) => {
    const target = Math.max(0, Number(targetSec) || 0)
    suppressTrackEnded = true
    try {
      if (inQueueTimeline()) {
        const localIdx = currentIndex.value - hlsSliceBaseIndex
        const segStart = hlsSegmentStarts[localIdx] ?? 0
        audio.value.currentTime = segStart + target
        syncHlsPlaybackTimes()
      } else {
        const cap = Number.isFinite(audio.value.duration) && audio.value.duration > 0
          ? Math.min(target, audio.value.duration)
          : target
        audio.value.currentTime = cap
        currentTime.value = cap
      }
      syncUserVolumeToAudio()
    } finally {
      suppressTrackEnded = false
    }
  }

  const applyLoopRegionIfNeeded = () => {
    if (!loopRegionEnabled.value) return
    const start = loopStartSec.value
    const end = loopEndSec.value
    if (!isValidLoopRegion(start, end)) return
    const ct = inQueueTimeline() ? currentTime.value : audio.value.currentTime
    if (shouldJumpLoopRegion(ct, end)) {
      seekToLocalSeconds(start)
    }
  }

  const setLoopStartAtCurrent = () => {
    const t = Math.max(0, Number(currentTime.value) || 0)
    loopStartSec.value = t
    const d = Number(duration.value) || 0
    if (loopEndSec.value <= t && d > t) {
      loopEndSec.value = d
    }
  }

  const setLoopEndAtCurrent = () => {
    const d = Number(duration.value) || 0
    if (d <= 0) return
    let t = Math.min(d, Math.max(0, Number(currentTime.value) || 0))
    if (t <= loopStartSec.value) {
      loopStartSec.value = Math.max(0, t - MIN_LOOP_REGION_SEC)
    }
    loopEndSec.value = t
    if (isValidLoopRegion(loopStartSec.value, loopEndSec.value)) {
      loopRegionEnabled.value = true
    }
  }

  const toggleLoopRegion = () => {
    if (loopRegionEnabled.value) {
      loopRegionEnabled.value = false
      return
    }
    let start = loopStartSec.value
    let end = loopEndSec.value
    const d = Number(duration.value) || 0
    if (!isValidLoopRegion(start, end) && d > MIN_LOOP_REGION_SEC) {
      start = 0
      end = d
      loopStartSec.value = start
      loopEndSec.value = end
    }
    if (isValidLoopRegion(start, end)) {
      loopRegionEnabled.value = true
    }
  }

  const setPlaybackRate = (rate) => {
    playbackRate.value = normalizePlaybackRate(rate)
    persistPlaybackRate(playbackRate.value)
    syncPlaybackRateToAudio()
    syncMediaSessionPosition()
  }

  const nudgePlaybackRate = (delta) => {
    setPlaybackRate(nudgeRate(playbackRate.value, delta))
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
    // Joined streams already cross tracks without a client-side fade.
    if (inQueueTimeline()) {
      const u = effectiveVolumeLinear()
      if (audio.value.volume !== u) audio.value.volume = u
      return
    }
    const dur = audio.value.duration
    const ct = audio.value.currentTime
    if (!Number.isFinite(dur) || dur <= 0 || !Number.isFinite(ct)) return
    const remaining = dur - ct
    const u = effectiveVolumeLinear()
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
      if (inQueueTimeline()) {
        const localIdx = currentIndex.value - hlsSliceBaseIndex
        const segStart = hlsSegmentStarts[localIdx] ?? 0
        audio.value.currentTime = segStart + time
        syncHlsPlaybackTimes()
        return
      }
      audio.value.currentTime = time
    },
  })

  const trackDurationFromQueue = (track) => {
    const d = Number(track?.duration ?? track?.duration_sec)
    return Number.isFinite(d) && d > 0 ? d : 0
  }

  /**
   * Joined-queue modes (HLS / continuous): audio.currentTime is the full slice timeline.
   * Map to the current track's local position/duration.
   * @returns {{ localCt: number, segDur: number } | null}
   */
  const hlsLocalPlaybackPosition = () => {
    if (!inQueueTimeline()) return null
    const localIdx = currentIndex.value - hlsSliceBaseIndex
    if (localIdx < 0 || localIdx >= hlsSegmentStarts.length) return null
    const segStart = hlsSegmentStarts[localIdx] ?? 0
    let segDur = hlsSegmentDurations[localIdx]
    if (!Number.isFinite(segDur) || segDur <= 0) {
      segDur = trackDurationFromQueue(currentTrack.value)
    }
    const audioCt = audio.value.currentTime
    if (!Number.isFinite(audioCt)) return null
    const localCt =
      segDur > 0
        ? Math.max(0, Math.min(audioCt - segStart, segDur))
        : Math.max(0, audioCt - segStart)
    return { localCt, segDur }
  }

  /** Continuous MP3: detect track boundaries from timeline position (no hls.js). */
  const syncContinuousTrackFromTime = () => {
    if (!continuousQueueMode || !hlsSegmentStarts.length) return
    const ct = audio.value.currentTime
    if (!Number.isFinite(ct)) return
    let localIdx = 0
    for (let i = hlsSegmentStarts.length - 1; i >= 0; i--) {
      if (ct >= (hlsSegmentStarts[i] ?? 0) - 0.05) {
        localIdx = i
        break
      }
    }
    handleHlsTrackIndex(hlsSliceBaseIndex + localIdx)
    syncHlsPlaybackTimes()
  }

  const syncHlsPlaybackTimes = () => {
    const pos = hlsLocalPlaybackPosition()
    if (!pos) return
    currentTime.value = pos.localCt
    if (pos.segDur > 0) duration.value = pos.segDur
  }

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

  const clearPendingContinuousSlice = ({ clearStandby = true } = {}) => {
    pendingContinuousSlice = null
    if (!clearStandby) return
    try {
      standbyAudio.pause()
    } catch {
      /* ignore */
    }
    standbyAudio.removeAttribute('src')
    standbyAudio.src = ''
    try {
      standbyAudio.load()
    } catch {
      /* ignore */
    }
  }

  const clearPreloadBuffer = () => {
    preloadedNextId = null
    earlyHandoffDone = false
    clearPendingContinuousSlice({ clearStandby: true })
  }

  const resetPlaybackBuffers = () => {
    clearPreloadBuffer()
    clearStreamUrlCache()
    if (!inQueueTimeline()) destroyQueueTimeline()
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

  const wantsHlsQueue = () =>
    shouldPreferHlsQueue({
      queueLength: queue.value.length,
      isShuffle: isShuffle.value,
      repeatMode: repeatMode.value,
    })

  const wantsContinuousQueue = () =>
    shouldPreferContinuousQueue({
      queueLength: queue.value.length,
      isShuffle: isShuffle.value,
      repeatMode: repeatMode.value,
    })

  const destroyQueueTimeline = () => {
    hlsQueueMode = false
    continuousQueueMode = false
    lastHlsTrackIndex = -1
    hlsSliceBaseIndex = 0
    hlsSegmentStarts = []
    hlsSegmentDurations = []
    clearPendingContinuousSlice({ clearStandby: true })
    if (queueHlsPlayer) queueHlsPlayer.destroy()
  }

  /** @deprecated alias — prefer destroyQueueTimeline */
  const destroyHlsQueue = destroyQueueTimeline

  const composePlaylistApiUrl = (ids) => {
    const q = `ids=${encodeURIComponent(ids.join(','))}`
    const base = (auth.serverUrl || '').replace(/\/$/, '')
    if (base) return `${base}/api/stream/playlist.m3u8?${q}`
    return `/api/stream/playlist.m3u8?${q}`
  }

  const composeContinuousApiUrl = (ids) => {
    const q = new URLSearchParams()
    q.set('ids', ids.join(','))
    if (auth.token) q.set('token', auth.token)
    const qs = q.toString()
    const base = (auth.serverUrl || '').replace(/\/$/, '')
    if (base) return `${base}/api/stream/continuous.mp3?${qs}`
    return `/api/stream/continuous.mp3?${qs}`
  }

  /**
   * Build a continuous/HLS slice plan without mutating the active timeline.
   * @returns {{ idx: number, slice: any[], ids: string[], segmentStarts: number[], segmentDurations: number[] } | null}
   */
  const buildQueueSlicePlan = (fromIndex, maxTracks = 48) => {
    if (!queue.value.length) return null
    const idx = Math.max(0, Math.min(fromIndex, queue.value.length - 1))
    const limit = Math.max(1, Math.min(48, Number(maxTracks) || 48))
    const slice = queue.value.slice(idx, idx + limit)
    const ids = slice.map((tr) => (tr?.id != null ? String(tr.id) : '')).filter(Boolean)
    if (!ids.length) return null
    const segmentDurations = slice.map((tr) => {
      const d = Number(tr?.duration_sec ?? tr?.duration)
      return Number.isFinite(d) && d > 0 ? d : 1
    })
    const segmentStarts = []
    let segmentAcc = 0
    for (const d of segmentDurations) {
      segmentStarts.push(segmentAcc)
      segmentAcc += d
    }
    return { idx, slice, ids, segmentStarts, segmentDurations }
  }

  const applyQueueSlicePlanToTimeline = (plan) => {
    hlsSliceBaseIndex = plan.idx
    hlsSegmentDurations = plan.segmentDurations
    hlsSegmentStarts = plan.segmentStarts
  }

  const prepareQueueSliceTimeline = (fromIndex, maxTracks = 48) => {
    const plan = buildQueueSlicePlan(fromIndex, maxTracks)
    if (!plan) {
      hlsSliceBaseIndex = 0
      hlsSegmentDurations = []
      hlsSegmentStarts = []
      return { idx: 0, slice: [], ids: [] }
    }
    applyQueueSlicePlanToTimeline(plan)
    return { idx: plan.idx, slice: plan.slice, ids: plan.ids }
  }

  const continuousSliceRemainingSec = () => {
    if (!continuousQueueMode || !hlsSegmentDurations.length) return null
    const total = hlsSegmentDurations.reduce((a, d) => a + (Number(d) > 0 ? Number(d) : 0), 0)
    const ct = audio.value?.currentTime
    if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(ct)) return null
    return Math.max(0, total - ct)
  }

  /** Absolute queue index where the next continuous window should start, or null. */
  const nextContinuousSliceStartIndex = () => {
    if (!continuousQueueMode || !hlsSegmentDurations.length) return null
    const lastInSlice = hlsSliceBaseIndex + hlsSegmentDurations.length - 1
    if (lastInSlice < queue.value.length - 1) return lastInSlice + 1
    if (repeatMode.value === 'all' && queue.value.length >= 1) return 0
    return null
  }

  const warmStandbyWithUrl = (url) => {
    if (!url || typeof url !== 'string') return
    try {
      standbyAudio.preload = 'auto'
      if (standbyAudio.src !== url) {
        standbyAudio.src = url
        standbyAudio.load()
      }
    } catch {
      /* ignore */
    }
  }

  /**
   * Prefetch the next continuous (or final direct) window before the pipe ends.
   * Continuous URLs must NOT be loaded on standby — each GET spawns an ffmpeg pipe.
   * Direct (single-file) URLs may warm on standby via load() only, never play().
   */
  const prepareNextContinuousSliceIfNeeded = () => {
    if (!continuousQueueMode || !auth.token) return
    if (pendingContinuousSlice) {
      if (pendingContinuousSlice.kind === 'direct') {
        warmStandbyWithUrl(pendingContinuousSlice.url)
      }
      return
    }
    const rem = continuousSliceRemainingSec()
    if (rem == null || rem > CONTINUOUS_SLICE_PREPARE_LEAD_SEC) return

    const nextFrom = nextContinuousSliceStartIndex()
    if (nextFrom == null) return
    // Same window already playing (repeat-all single-slice queue): nothing to prefetch.
    if (nextFrom === hlsSliceBaseIndex) return

    const plan = buildQueueSlicePlan(nextFrom, CONTINUOUS_SLICE_TRACKS)
    if (!plan?.ids?.length) return

    if (plan.ids.length >= 2) {
      const url = composeContinuousApiUrl(plan.ids)
      if (!url) return
      pendingContinuousSlice = {
        kind: 'continuous',
        fromIndex: plan.idx,
        ids: plan.ids,
        url,
        segmentStarts: plan.segmentStarts,
        segmentDurations: plan.segmentDurations,
      }
      return
    }

    // Last track after a multi-track pipe — sync direct URL handoff.
    const track = queue.value[plan.idx]
    const trackId = track?.id != null ? String(track.id) : ''
    if (!trackId) return
    const url = getCachedStreamUrl(trackId) || composeStreamUrl(trackId)
    if (!url) {
      void auth.prefetchStreamSignatures([trackId]).then(() => {
        if (!continuousQueueMode || pendingContinuousSlice) return
        const ready = composeStreamUrl(trackId)
        if (!ready) return
        cacheStreamUrl(trackId, ready)
        pendingContinuousSlice = {
          kind: 'direct',
          index: plan.idx,
          trackId,
          url: ready,
        }
        warmStandbyWithUrl(ready)
      })
      return
    }
    cacheStreamUrl(trackId, url)
    pendingContinuousSlice = {
      kind: 'direct',
      index: plan.idx,
      trackId,
      url,
    }
    warmStandbyWithUrl(url)
  }

  /**
   * Apply a prepared next window with no await (Android background-safe).
   * @returns {boolean}
   */
  const commitPendingContinuousSliceSync = () => {
    const pending = pendingContinuousSlice
    if (!pending?.url) return false
    pendingContinuousSlice = null

    if (pending.kind === 'direct') {
      const track = queue.value[pending.index]
      if (!track?.id || String(track.id) !== String(pending.trackId)) {
        clearPendingContinuousSlice({ clearStandby: true })
        return false
      }
      destroyQueueTimeline()
      currentIndex.value = pending.index
      applyStreamUrlToMainAudio(track, pending.url)
      isPlaying.value = true
      if (typeof navigator !== 'undefined' && navigator.mediaSession) {
        navigator.mediaSession.playbackState = 'playing'
      }
      playCurrentImmediate()
      return true
    }

    if (queueHlsPlayer) queueHlsPlayer.destroy()
    continuousQueueMode = true
    hlsQueueMode = false
    applyQueueSlicePlanToTimeline({
      idx: pending.fromIndex,
      segmentStarts: pending.segmentStarts,
      segmentDurations: pending.segmentDurations,
    })
    lastHlsTrackIndex = pending.fromIndex
    currentIndex.value = pending.fromIndex

    suppressTrackEnded = true
    try {
      playSessionPeakSec.value = 0
      audio.value.src = pending.url
      audio.value.load()
    } catch {
      suppressTrackEnded = false
      clearPendingContinuousSlice({ clearStandby: true })
      return false
    } finally {
      suppressTrackEnded = false
    }

    const tr = queue.value[pending.fromIndex]
    playSessionTrackId.value = tr?.id ?? null
    syncHlsPlaybackTimes()
    syncUserVolumeToAudio()
    syncPlaybackRateToAudio()
    // Keep MediaSession metadata stable while hidden; reinforce playing only.
    if (isPlaybackBackgrounded()) {
      reinforcePlayingMediaSession()
    } else {
      syncMediaSession()
    }
    isPlaying.value = true
    if (typeof navigator !== 'undefined' && navigator.mediaSession) {
      navigator.mediaSession.playbackState = 'playing'
    }
    playCurrentImmediate()
    return true
  }

  /**
   * @param {'ended' | 'early-bg' | 'near-end'} reason
   */
  const tryCommitContinuousSliceHandoff = (reason) => {
    if (!continuousQueueMode || !pendingContinuousSlice) return false
    if (reason === 'ended') return commitPendingContinuousSliceSync()

    const rem = continuousSliceRemainingSec()
    if (rem == null) return false

    if (reason === 'early-bg') {
      if (!isPlaybackBackgrounded()) return false
      if (rem > CONTINUOUS_SLICE_BG_COMMIT_LEAD_SEC) return false
      flushPlaySessionToServer()
      return commitPendingContinuousSliceSync()
    }

    if (reason === 'near-end') {
      // Backup if `ended` is delayed/throttled while still technically "playing".
      if (rem > 0.4) return false
      flushPlaySessionToServer()
      return commitPendingContinuousSliceSync()
    }
    return false
  }

  const seekQueueTimelineToIndex = (absoluteIndex) => {
    if (!inQueueTimeline()) return false
    const localIdx = absoluteIndex - hlsSliceBaseIndex
    if (localIdx < 0 || localIdx >= hlsSegmentStarts.length) return false
    const segStart = hlsSegmentStarts[localIdx]
    if (!Number.isFinite(segStart)) return false
    suppressTrackEnded = true
    try {
      audio.value.currentTime = segStart
      handleHlsTrackIndex(absoluteIndex)
      syncHlsPlaybackTimes()
    } finally {
      suppressTrackEnded = false
    }
    return true
  }

  const reinforcePlayingMediaSession = () => {
    if (!audio.value || audio.value.paused) return
    isPlaying.value = true
    if (typeof navigator === 'undefined' || !navigator.mediaSession) return
    navigator.mediaSession.playbackState = 'playing'
    // Screen-off track boundaries: reclaim audio focus without swapping metadata/artwork.
    try {
      const p = audio.value.play()
      if (p?.catch) p.catch(() => {})
    } catch {
      /* ignore */
    }
  }

  const handleHlsTrackIndex = (index) => {
    if (!Number.isFinite(index) || index === lastHlsTrackIndex) return
    flushPlaySessionToServer()
    lastHlsTrackIndex = index
    if (index >= 0 && index < queue.value.length) {
      currentIndex.value = index
      const tr = queue.value[index]
      playSessionTrackId.value = tr?.id ?? null
      playSessionPeakSec.value = 0
      clearLoopRegion()
      syncHlsPlaybackTimes()
      // 곡 경계에서 MediaSession metadata/artwork를 바꾸면 Android가 출력을 끊고
      // currentTime만 남는 무음 상태가 된다. 백그라운드에서는 playing만 유지한다.
      if (isPlaybackBackgrounded()) {
        reinforcePlayingMediaSession()
        return
      }
      if (!audio.value.paused) isPlaying.value = true
      syncMediaSession()
      if (typeof navigator !== 'undefined' && navigator.mediaSession && !audio.value.paused) {
        navigator.mediaSession.playbackState = 'playing'
      }
    }
  }

  const fallbackFromHls = async () => {
    destroyQueueTimeline()
    await startPlaybackDirect()
  }

  const ensureQueueHlsPlayer = () => {
    if (!queueHlsPlayer) {
      queueHlsPlayer = new QueueHlsPlayer(audio.value, {
        onTrackIndex: handleHlsTrackIndex,
        onFatalError: () => {
          void fallbackFromHls()
        },
      })
    }
    return queueHlsPlayer
  }

  const startContinuousPlayback = async (fromIndex = currentIndex.value) => {
    const { idx, ids } = prepareQueueSliceTimeline(fromIndex, CONTINUOUS_SLICE_TRACKS)
    currentIndex.value = idx
    if (ids.length < 2) {
      destroyQueueTimeline()
      await startPlaybackDirect({ allowStandbyPreload: false })
      return
    }

    if (queueHlsPlayer) queueHlsPlayer.destroy()
    continuousQueueMode = true
    hlsQueueMode = false
    lastHlsTrackIndex = idx
    // Dual-audio play() handoff causes silent progress on Android. Standby may
    // warm a final direct file only; never start a second continuous ffmpeg GET.
    clearPendingContinuousSlice({ clearStandby: true })
    preloadedNextId = null
    earlyHandoffDone = false

    const url = composeContinuousApiUrl(ids)
    suppressTrackEnded = true
    try {
      playSessionPeakSec.value = 0
      audio.value.src = url
      audio.value.load()
    } catch (e) {
      console.warn('Continuous queue unavailable, falling back', e)
      destroyQueueTimeline()
      if (wantsHlsQueue() && auth.token) {
        await startHlsPlayback(idx)
        return
      }
      await startPlaybackDirect({ allowStandbyPreload: false })
      return
    } finally {
      suppressTrackEnded = false
    }

    const tr = queue.value[idx]
    playSessionTrackId.value = tr?.id ?? null
    syncHlsPlaybackTimes()
    syncUserVolumeToAudio()
    syncPlaybackRateToAudio()
    syncMediaSession()
    try {
      await play()
    } catch (e) {
      console.warn('Continuous queue play failed, falling back', e)
      destroyQueueTimeline()
      if (wantsHlsQueue() && auth.token) {
        await startHlsPlayback(idx)
        return
      }
      // Android: never enter dual-element early-handoff mode after continuous fails.
      await startPlaybackDirect({ allowStandbyPreload: false })
      return
    }
  }

  const startHlsPlayback = async (fromIndex = currentIndex.value) => {
    const { idx, ids, slice } = prepareQueueSliceTimeline(fromIndex)
    currentIndex.value = idx
    if (ids.length < 2) {
      destroyQueueTimeline()
      await startPlaybackDirect()
      return
    }

    await auth.prefetchStreamSignatures(ids)
    const playlistUrl = composePlaylistApiUrl(ids)
    const segmentDurations = slice.map((tr) => {
      const d = Number(tr?.duration_sec ?? tr?.duration)
      return Number.isFinite(d) && d > 0 ? d : 1
    })

    continuousQueueMode = false
    const hls = ensureQueueHlsPlayer()
    hlsQueueMode = true
    lastHlsTrackIndex = idx
    suppressTrackEnded = true
    try {
      await hls.load(playlistUrl, {
        authorization: auth.token ? `Bearer ${auth.token}` : '',
        startIndex: idx,
        segmentDurations,
      })
    } catch (e) {
      console.warn('HLS queue unavailable, falling back to direct stream', e)
      destroyQueueTimeline()
      await startPlaybackDirect()
      return
    } finally {
      suppressTrackEnded = false
    }

    const tr = queue.value[idx]
    playSessionPeakSec.value = 0
    playSessionTrackId.value = tr?.id ?? null
    syncHlsPlaybackTimes()
    syncUserVolumeToAudio()
    syncPlaybackRateToAudio()
    syncMediaSession()
    await play()
    preloadUpcomingTrack()
  }

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
  const collectPrefetchTargets = (list, fromIndex, ahead = AGGRESSIVE_PREFETCH_AHEAD) => {
    if (!list?.length) return []
    const targets = []
    const seen = new Set()
    const add = (track) => {
      if (!track?.id) return
      const id = String(track.id)
      if (seen.has(id)) return
      seen.add(id)
      targets.push(track)
    }

    const safeStart = Math.max(0, Math.min(fromIndex, list.length - 1))
    add(list[safeStart])

    for (let i = 1; i <= ahead; i++) {
      const idx = safeStart + i
      if (idx < list.length) {
        add(list[idx])
        continue
      }
      if (repeatMode.value === 'all') {
        add(list[idx % list.length])
      } else {
        break
      }
    }
    return targets
  }

  const warmStreamUrlCache = async (
    tracks = queue.value,
    { fromIndex = currentIndex.value, ahead = AGGRESSIVE_PREFETCH_AHEAD } = {},
  ) => {
    if (!auth.token) return
    const list = Array.isArray(tracks) ? tracks : queue.value
    const targets = collectPrefetchTargets(list, fromIndex, ahead)
    const ids = targets.map((t) => String(t.id)).slice(0, 48)
    if (!ids.length) return
    await auth.prefetchStreamSignatures(ids)
    for (const id of ids) {
      const url = composeStreamUrl(id)
      if (url) cacheStreamUrl(id, url)
    }
  }

  const playWhenReady = async (el = audio.value) => {
    if (!el?.src && !inQueueTimeline()) return
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

  const markPlaybackIntent = () => {
    playRetryActive = true
  }

  const clearPlaybackIntent = () => {
    playRetryActive = false
    if (playRetryTimer != null) {
      clearTimeout(playRetryTimer)
      playRetryTimer = null
    }
  }

  const onPlayRejected = () => {
    isPlaying.value = false
    if (typeof navigator !== 'undefined' && navigator.mediaSession) {
      navigator.mediaSession.playbackState = 'paused'
    }
    schedulePlayRetry()
  }

  /** 화면 꺼짐·iOS 백그라운드에서 `play()`가 막힐 때 짧게 재시도 */
  const schedulePlayRetry = () => {
    if (playRetryTimer != null) clearTimeout(playRetryTimer)
    let attempts = 0
    const tick = async () => {
      if (!playRetryActive || attempts >= 10) return
      if (!audio.value.paused) {
        clearPlaybackIntent()
        return
      }
      try {
        await audio.value.play()
      } catch {
        /* ignore */
      }
      attempts += 1
      if (playRetryActive && audio.value.paused) {
        playRetryTimer = setTimeout(tick, 400)
      }
    }
    playRetryTimer = setTimeout(tick, 250)
  }

  const syncMediaSessionPosition = () => {
    if (typeof navigator === 'undefined' || !navigator.mediaSession?.setPositionState) return
    // Background metadata/position jumps at track boundaries mute Android output
    // while currentTime keeps advancing ("silent progress").
    if (isPlaybackBackgrounded() && inQueueTimeline()) return

    // Continuous pipe: report the joined timeline so position never resets at boundaries.
    if (continuousQueueMode && hlsSegmentStarts.length) {
      const total = hlsSegmentDurations.reduce((a, d) => a + (Number(d) > 0 ? Number(d) : 0), 0)
      const pos = audio.value.currentTime
      if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(pos)) return
      try {
        navigator.mediaSession.setPositionState({
          duration: total,
          playbackRate: playbackRate.value,
          position: Math.min(Math.max(0, pos), total),
        })
      } catch {
        /* ignore */
      }
      return
    }

    const dur = inQueueTimeline() ? duration.value : audio.value.duration
    const pos = inQueueTimeline() ? currentTime.value : audio.value.currentTime
    if (!Number.isFinite(dur) || dur <= 0 || !Number.isFinite(pos)) return
    try {
      navigator.mediaSession.setPositionState({
        duration: dur,
        playbackRate: playbackRate.value,
        position: Math.min(pos, dur),
      })
    } catch {
      /* 일부 브라우저 미지원 */
    }
  }

  const playCurrentImmediate = () => {
    markPlaybackIntent()
    try {
      const p = audio.value.play()
      if (p?.then) {
        p.catch(() => onPlayRejected())
      }
    } catch {
      onPlayRejected()
    }
  }

  const applyStreamUrlToMainAudio = (track, streamUrl) => {
    if (!track?.id || !streamUrl) return
    destroyHlsQueue()
    earlyHandoffDone = false
    suppressTrackEnded = true
    try {
      playSessionPeakSec.value = 0
      if (audio.value.src !== streamUrl) {
        audio.value.src = streamUrl
        audio.value.load()
      }
      playSessionTrackId.value = track.id
      syncUserVolumeToAudio()
      syncPlaybackRateToAudio()
      syncMediaSession()
    } finally {
      suppressTrackEnded = false
    }
  }

  const preloadUpcomingTrack = () => {
    // Continuous/HLS already carry upcoming audio in one session.
    if (inQueueTimeline()) return
    // Android standby preload only feeds early handoff, which we disable.
    if (isAndroidPlaybackUa()) return
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
        if (standbyAudio.src !== url) {
          standbyAudio.src = url
          standbyAudio.load()
        }
      })
      return
    }
    preloadedNextId = nextId
    if (standbyAudio.src !== url) {
      standbyAudio.src = url
      standbyAudio.load()
    }
  }

  /**
   * standby에 버퍼된 다음 곡을 main으로 승격해 재생한다.
   * src 재설정 없이 엘리먼트만 바꿔, 화면 꺼짐 직전에도 미디어 파이프라인이 이어지게 한다.
   *
   * Android: 먼저 역할을 바꾸고 incoming.play()한 뒤 outgoing을 pause한다.
   * 예전처럼 활성 엘리먼트를 먼저 pause하면 MediaSession이 paused가 되어
   * 다음 곡이 잠깐만 나오다 무음(진행만 감)이 된다.
   */
  const promoteStandbyToMain = (track) => {
    // Android: swapping <audio> elements after a brief dual-play yields
    // "progress keeps moving, no sound" until the screen wakes.
    if (isAndroidPlaybackUa()) return false
    if (!track?.id || !standbyAudio.src) return false
    if (preloadedNextId && preloadedNextId !== String(track.id)) return false

    const outgoing = audio.value
    const incoming = standbyAudio

    suppressTrackEnded = true
    suppressPlayStateEvents = true
    try {
      incoming.volume = effectiveVolumeLinear()
      incoming.playbackRate = normalizePlaybackRate(playbackRate.value)
      if (incoming.paused || incoming.currentTime > 0.35) {
        try {
          incoming.currentTime = 0
        } catch {
          /* ignore */
        }
      }

      audio.value = incoming
      standbyAudio = outgoing

      isPlaying.value = true
      if (typeof navigator !== 'undefined' && navigator.mediaSession) {
        navigator.mediaSession.playbackState = 'playing'
      }

      try {
        const p = incoming.play()
        if (p?.then) p.catch(() => onPlayRejected())
      } catch {
        onPlayRejected()
      }

      try {
        outgoing.pause()
      } catch {
        /* ignore */
      }

      standbyAudio.removeAttribute('src')
      standbyAudio.src = ''
      try {
        standbyAudio.load()
      } catch {
        /* ignore */
      }

      preloadedNextId = null
      playSessionPeakSec.value = 0
      playSessionTrackId.value = track.id
      currentTime.value = Number.isFinite(incoming.currentTime) ? incoming.currentTime : 0
      const metaDur = incoming.duration
      duration.value =
        Number.isFinite(metaDur) && metaDur > 0
          ? metaDur
          : trackDurationFromQueue(track)
      syncMediaSession()
      if (typeof navigator !== 'undefined' && navigator.mediaSession) {
        navigator.mediaSession.playbackState = 'playing'
      }
    } finally {
      suppressTrackEnded = false
      suppressPlayStateEvents = false
    }
    return true
  }

  /**
   * 곡이 끝나기 직전에 standby를 play()하고 main을 교체한다.
   * ended 이후에야 src를 바꾸면 화면 꺼짐 상태에서 JS가 멈춰 다음 곡이 안 나온다.
   */
  const tryEarlyHandoff = () => {
    if (isAndroidPlaybackUa()) return
    if (inQueueTimeline() || earlyHandoffDone || suppressTrackEnded) return
    if (!hasNextTrackAutoplay()) return
    const dur = audio.value.duration
    const ct = audio.value.currentTime
    if (!Number.isFinite(dur) || dur <= 0 || !Number.isFinite(ct)) return
    if (dur - ct > EARLY_HANDOFF_LEAD_SEC) return

    const ni = resolveNextIndex()
    if (ni == null) return
    const track = queue.value[ni]
    if (!track?.id) return

    if (preloadedNextId !== String(track.id) || !standbyAudio.src) {
      preloadUpcomingTrack()
      return
    }
    // HAVE_CURRENT_DATA 이상이면 시도 (완전 버퍼 전에도 play가 이어질 수 있음)
    if (standbyAudio.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return

    earlyHandoffDone = true
    flushPlaySessionToServer()
    currentIndex.value = ni

    // 교체 전에 standby를 먼저 play해 Android 오디오 포커스를 끊기지 않게 한다.
    suppressPlayStateEvents = true
    try {
      standbyAudio.volume = effectiveVolumeLinear()
      standbyAudio.playbackRate = normalizePlaybackRate(playbackRate.value)
      if (standbyAudio.currentTime > 0.05) {
        try {
          standbyAudio.currentTime = 0
        } catch {
          /* ignore */
        }
      }
      const warm = standbyAudio.play()
      if (warm?.catch) warm.catch(() => {})
    } catch {
      /* ignore */
    } finally {
      suppressPlayStateEvents = false
    }

    if (!promoteStandbyToMain(track)) {
      earlyHandoffDone = false
      return
    }
    markPlaybackIntent()
    void warmStreamUrlCache(queue.value, { fromIndex: ni })
    earlyHandoffDone = false
    preloadUpcomingTrack()
  }

  /**
   * 곡 종료·잠금화면 next — await 없이 URL 교체 + play() (모바일 백그라운드)
   */
  const advanceToNextTrackSync = () => {
    if (inQueueTimeline()) return
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

    if (promoteStandbyToMain(track)) {
      markPlaybackIntent()
      void warmStreamUrlCache(queue.value, { fromIndex: ni })
      preloadUpcomingTrack()
      return
    }

    const streamUrl = getCachedStreamUrl(track.id) || composeStreamUrl(track.id)
    if (!streamUrl) {
      void advanceToNextTrackAsync()
      return
    }

    cacheStreamUrl(track.id, streamUrl)
    applyStreamUrlToMainAudio(track, streamUrl)
    isPlaying.value = true
    if (typeof navigator !== 'undefined' && navigator.mediaSession) {
      navigator.mediaSession.playbackState = 'playing'
    }
    playCurrentImmediate()
    void warmStreamUrlCache(queue.value, { fromIndex: ni })
    preloadUpcomingTrack()
  }

  /** 화면/앱 복귀 시 무음·정지·HLS 로더 정체를 복구한다 */
  const recoverPlaybackAfterWake = () => {
    if (!currentTrack.value?.id) return
    const el = audio.value
    syncUserVolumeToAudio()

    if (hlsQueueMode && queueHlsPlayer) {
      queueHlsPlayer.resumeLoad()
    }

    // Continuous slice may have ended (or stalled near end) while JS was frozen.
    if (continuousQueueMode) {
      prepareNextContinuousSliceIfNeeded()
      const sliceRem = continuousSliceRemainingSec()
      if (
        pendingContinuousSlice &&
        (el.ended || (sliceRem != null && sliceRem <= 0.75) || (el.paused && sliceRem != null && sliceRem <= 1.5))
      ) {
        flushPlaySessionToServer()
        if (commitPendingContinuousSliceSync()) return
      }
    }

    const dur = el.duration
    const ct = el.currentTime
    const nearEnd =
      Number.isFinite(dur) &&
      dur > 0 &&
      Number.isFinite(ct) &&
      (el.ended || dur - ct <= 0.75)

    if (!inQueueTimeline() && el.paused && nearEnd && hasNextTrackAutoplay()) {
      advanceToNextTrackSync()
      return
    }

    // paused가 아니어도 Android는 오디오 포커스만 뺏는 경우가 있다.
    // 진행 바는 움직이는데 소리만 없는 상태가 그 증상 → play()로 출력을 다시 잡는다.
    const shouldBePlaying =
      playRetryActive || isPlaying.value || (!el.paused && !el.ended)

    if (!shouldBePlaying || (!el.src && !inQueueTimeline())) return

    markPlaybackIntent()
    if (typeof navigator !== 'undefined' && navigator.mediaSession) {
      navigator.mediaSession.playbackState = 'playing'
    }
    void playWhenReady(el)
      .then(() => {
        if (!el.paused) {
          isPlaying.value = true
          clearPlaybackIntent()
        }
      })
      .catch(() => onPlayRejected())
  }

  const advanceToNextTrackAsync = async () => {
    if (!currentTrack.value?.id) return
    await startPlayback()
  }

  const bumpPlaySessionPeak = () => {
    const tr = currentTrack.value
    if (!tr?.id || playSessionTrackId.value == null) return
    if (String(tr.id) !== String(playSessionTrackId.value)) return
    // HLS 큐 모드의 audio.currentTime은 큐 전체 타임라인이라 그대로 쓰면
    // 두 번째 곡부터 peak가 부풀어 스킵해도 완청으로 기록된다. 곡 기준으로 환산.
    const t = inQueueTimeline() ? hlsLocalPlaybackPosition()?.localCt : audio.value.currentTime
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

    const title = tr.title || t('player.unknownTrack')
    const artist = tr.artist || t('common.unknownArtist')
    const album = tr.album || undefined
    // Artwork fetch while screen-off often steals Android audio focus after a track change.
    const allowArtwork = !isPlaybackBackgrounded()
    const cover = allowArtwork && auth.token ? auth.coverSrc('track', tr.id) : ''
    const artwork = cover ? [{ src: cover, sizes: '512x512', type: 'image/jpeg' }] : []

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist,
        ...(album ? { album } : {}),
        ...(artwork.length ? { artwork } : {}),
      })
    } catch {
      navigator.mediaSession.metadata = new MediaMetadata({ title, artist })
    }
    navigator.mediaSession.playbackState = isPlaying.value || !audio.value?.paused ? 'playing' : 'paused'
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

  watch(
    () => [
      currentTrack.value?.id,
      currentTrack.value?.title,
      currentTrack.value?.artist,
      currentTrack.value?.album,
      currentTrack.value?.volume_pct,
      isPlaying.value,
      volume.value,
    ],
    () => {
      // Avoid metadata churn while backgrounded; track-boundary handler already reinforces playing.
      if (isPlaybackBackgrounded() && inQueueTimeline()) {
        reinforcePlayingMediaSession()
        return
      }
      syncMediaSession()
    },
  )

  watch(
    () => [currentTrack.value?.id, currentTrack.value?.volume_pct, volume.value],
    () => {
      syncUserVolumeToAudio()
    },
  )

  const initAudio = () => {
    if (audioListenersBound) return
    audioListenersBound = true
    syncUserVolumeToAudio()
    syncPlaybackRateToAudio()
    bindMediaSessionHandlers()
    syncMediaSession()

    const isActiveEl = (el) => el === audio.value

    const onTimeUpdate = (e) => {
      if (!isActiveEl(e.target)) return
      if (continuousQueueMode) {
        syncContinuousTrackFromTime()
      } else if (hlsQueueMode) {
        syncHlsPlaybackTimes()
      } else {
        currentTime.value = audio.value.currentTime
      }
      applyLoopRegionIfNeeded()
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
      tryEarlyHandoff()
      if (continuousQueueMode) {
        prepareNextContinuousSliceIfNeeded()
        if (!tryCommitContinuousSliceHandoff('early-bg')) {
          tryCommitContinuousSliceHandoff('near-end')
        }
      }
    }
    const onSeeked = (e) => {
      if (!isActiveEl(e.target)) return
      bumpPlaySessionPeak()
      syncUserVolumeToAudio()
    }
    const onLoadedMetadata = (e) => {
      if (!isActiveEl(e.target)) return
      if (inQueueTimeline()) {
        syncHlsPlaybackTimes()
      } else {
        duration.value = audio.value.duration
      }
      bumpPlaySessionPeak()
    }
    const onEnded = (e) => {
      if (!isActiveEl(e.target)) return
      if (suppressTrackEnded) return
      if (inQueueTimeline()) {
        flushPlaySessionToServer()
        // Continuous: prefer sync handoff with a URL prepared during the last track.
        if (continuousQueueMode && tryCommitContinuousSliceHandoff('ended')) {
          return
        }
        // Slice ended but queue continues — open the next continuous/HLS window.
        const ni = resolveNextIndex()
        if (ni != null && (ni !== currentIndex.value || repeatMode.value === 'all')) {
          if (continuousQueueMode) {
            void startContinuousPlayback(ni === currentIndex.value ? 0 : ni)
            return
          }
          if (hlsQueueMode) {
            void startHlsPlayback(ni === currentIndex.value ? 0 : ni)
            return
          }
        }
        pause()
        return
      }
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
    }
    const onPlay = (e) => {
      if (!isActiveEl(e.target)) return
      isPlaying.value = true
      if (!suppressPlayStateEvents) clearPlaybackIntent()
    }
    const onPause = (e) => {
      if (!isActiveEl(e.target)) return
      if (suppressPlayStateEvents) return
      isPlaying.value = false
      syncUserVolumeToAudio()
    }

    const onWaiting = (e) => {
      if (!isActiveEl(e.target)) return
      if (inQueueTimeline() || playRetryActive) markPlaybackIntent()
    }

    const bindEl = (el) => {
      el.addEventListener('timeupdate', onTimeUpdate)
      el.addEventListener('seeked', onSeeked)
      el.addEventListener('loadedmetadata', onLoadedMetadata)
      el.addEventListener('ended', onEnded)
      el.addEventListener('play', onPlay)
      el.addEventListener('pause', onPause)
      el.addEventListener('waiting', onWaiting)
    }
    bindEl(audio.value)
    bindEl(standbyAudio)

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') {
          // 페이드로 낮아진 볼륨·MediaSession paused가 백그라운드에서 출력을 죽이지 않게
          syncUserVolumeToAudio()
          if (
            typeof navigator !== 'undefined' &&
            navigator.mediaSession &&
            !audio.value.paused
          ) {
            isPlaying.value = true
            navigator.mediaSession.playbackState = 'playing'
          }
          return
        }
        recoverPlaybackAfterWake()
      })
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('pageshow', () => recoverPlaybackAfterWake())
      window.addEventListener('focus', () => recoverPlaybackAfterWake())
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
    syncPlaybackRateToAudio()
    return true
  }

  const play = async () => {
    if (!audio.value.src && !inQueueTimeline()) return
    markPlaybackIntent()
    try {
      await playWhenReady(audio.value)
      if (audio.value.paused) schedulePlayRetry()
    } catch (e) {
      if (e?.name !== 'AbortError') {
        console.error('재생 시작 실패:', e)
        onPlayRejected()
      } else {
        clearPlaybackIntent()
      }
    }
  }

  const startPlaybackDirect = async ({ allowStandbyPreload = true } = {}) => {
    const track = currentTrack.value
    if (!track?.id) return
    await warmStreamUrlCache(queue.value, { fromIndex: currentIndex.value })
    const url = getCachedStreamUrl(track.id) || (await buildStreamUrl(track.id))
    if (!url) return
    applyStreamUrlToMainAudio(track, url)
    await play()
    if (allowStandbyPreload && !isAndroidPlaybackUa()) preloadUpcomingTrack()
  }

  const startPlayback = async () => {
    // 모바일: 재생 시작 시 CDN(또는 light 폴백)에서 hls.js를 미리 받아 둠
    if (isMobilePlaybackUa()) void prefetchHlsModule()
    if (wantsContinuousQueue() && auth.token) {
      await startContinuousPlayback(currentIndex.value)
      return
    }
    if (wantsHlsQueue() && auth.token) {
      await startHlsPlayback(currentIndex.value)
      return
    }
    destroyQueueTimeline()
    await startPlaybackDirect({ allowStandbyPreload: !isAndroidPlaybackUa() })
  }
  const pause = () => {
    clearPlaybackIntent()
    audio.value.pause()
  }
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
    if (queue.value.length === 0) return
    const ni = resolveNextIndex()
    if (ni == null) {
      pause()
      return
    }
    if (inQueueTimeline() && seekQueueTimelineToIndex(ni)) {
      if (audio.value.paused) await play()
      return
    }
    resetPlaybackBuffers()
    currentIndex.value = ni
    if (wantsContinuousQueue() && auth.token) {
      destroyQueueTimeline()
      await startContinuousPlayback(ni)
      return
    }
    if (wantsHlsQueue() && auth.token) {
      destroyQueueTimeline()
      await startHlsPlayback(ni)
      return
    }
    await startPlaybackDirect()
  }

  const prev = async () => {
    if (currentTime.value > 3 && !inQueueTimeline()) {
      audio.value.currentTime = 0
      return
    }
    if (currentTime.value > 3 && inQueueTimeline()) {
      seekToLocalSeconds(0)
      return
    }
    flushPlaySessionToServer()
    const pi = currentIndex.value <= 0 ? queue.value.length - 1 : currentIndex.value - 1
    if (inQueueTimeline() && seekQueueTimelineToIndex(pi)) {
      if (audio.value.paused) await play()
      return
    }
    resetPlaybackBuffers()
    currentIndex.value = pi
    if (wantsContinuousQueue() && auth.token) {
      destroyQueueTimeline()
      await startContinuousPlayback(pi)
      return
    }
    if (wantsHlsQueue() && auth.token) {
      destroyQueueTimeline()
      await startHlsPlayback(pi)
      return
    }
    await startPlaybackDirect()
  }

  /**
   * @param {object[]} newQueue
   * @param {number} startIndex
   * @param {{ startPositionSec?: number }} [opts] 다른 기기에서 이관받을 때 그 위치에서 이어 재생
   */
  const playNewQueue = async (newQueue, startIndex = 0, opts = {}) => {
    flushPlaySessionToServer()
    resetPlaybackBuffers()
    queue.value = [...newQueue]
    currentIndex.value = startIndex
    await startPlayback()

    const startAt = Number(opts.startPositionSec)
    if (Number.isFinite(startAt) && startAt > 0) {
      await seekToSeconds(startAt)
    }
  }

  /**
   * 절대 초 위치로 이동. duration은 loadedmetadata 이후에야 확정되므로 잠깐 기다린다.
   * (progress setter는 %를 쓰기 때문에 duration이 0이면 무의미해진다)
   */
  const seekToSeconds = async (positionSec) => {
    const target = Math.max(0, Number(positionSec) || 0)
    if (!target) return

    const el = audio.value
    const ready = () => Number.isFinite(el.duration) && el.duration > 0
    if (!ready()) {
      await new Promise((resolve) => {
        const done = () => {
          el.removeEventListener('loadedmetadata', done)
          resolve()
        }
        el.addEventListener('loadedmetadata', done, { once: true })
        setTimeout(done, 3000)
      })
    }
    if (!ready()) return

    if (inQueueTimeline()) {
      const localIdx = currentIndex.value - hlsSliceBaseIndex
      const segStart = hlsSegmentStarts[localIdx] ?? 0
      el.currentTime = segStart + target
      syncHlsPlaybackTimes()
      return
    }
    el.currentTime = Math.min(target, el.duration)
    currentTime.value = el.currentTime
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
            title: (String(cur.title || '').trim() || t('player.unknownTrack')).slice(0, 300),
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
    () => [
      queue.value.map((t) => t?.id).join(','),
      currentIndex.value,
      queue.value[currentIndex.value]?.title,
    ],
    () => {
      clearTimeout(queuePersistTimer)
      queuePersistTimer = setTimeout(saveQueueSnapshot, 350)
    },
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

  watch([isShuffle, repeatMode], () => {
    if (inQueueTimeline()) destroyQueueTimeline()
  })

  watch(
    () => currentTrack.value?.id,
    () => clearLoopRegion(),
  )

  watch(
    () => duration.value,
    (d) => {
      const dur = Number(d) || 0
      if (dur <= 0) return
      if (loopEndSec.value > dur) loopEndSec.value = dur
      if (loopStartSec.value > dur) loopStartSec.value = 0
    },
  )

  return {
    queue,
    currentIndex,
    isPlaying,
    volume,
    currentTime,
    duration,
    isShuffle,
    repeatMode,
    playbackRate,
    loopRegionEnabled,
    loopStartSec,
    loopEndSec,
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
    seekToSeconds,
    toggleShuffle,
    toggleRepeat,
    setPlaybackRate,
    nudgePlaybackRate,
    setLoopStartAtCurrent,
    setLoopEndAtCurrent,
    toggleLoopRegion,
    clearLoopRegion,
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
