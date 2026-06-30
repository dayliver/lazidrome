/** hls.js는 모바일 큐 재생 시에만 동적 로드 (초기 번들 ~500KB 절감) */
let hlsModulePromise = null

export function loadHlsModule() {
  if (!hlsModulePromise) {
    hlsModulePromise = import('hls.js').then((m) => m.default)
  }
  return hlsModulePromise
}

function isMediaSourceHlsCapable() {
  if (typeof window === 'undefined') return false
  try {
    const MediaSourceRef = window.MediaSource || window.WebKitMediaSource
    if (!MediaSourceRef?.isTypeSupported) return false
    return (
      MediaSourceRef.isTypeSupported('video/mp4; codecs="avc1.42E01E,mp4a.40.2"') ||
      MediaSourceRef.isTypeSupported('application/vnd.apple.mpegurl')
    )
  } catch {
    return false
  }
}

export function canPlayNativeHls(audioEl) {
  if (!audioEl?.canPlayType) return false
  const v = audioEl.canPlayType('application/vnd.apple.mpegurl')
  return v === 'probably' || v === 'maybe'
}

/** 동기 판별용 — 실제 재생 전 MSE 가능 여부만 검사 (hls.js 미로드) */
export function isHlsJsSupported() {
  return isMediaSourceHlsCapable()
}

/**
 * @param {{ queueLength: number, isShuffle: boolean, repeatMode: string }} opts
 */
export function shouldPreferHlsQueue(opts) {
  if (typeof navigator === 'undefined') return false
  if (!opts || opts.queueLength < 2) return false
  if (opts.isShuffle) return false
  if (opts.repeatMode === 'one') return false
  const ua = navigator.userAgent
  if (!/Android|iPhone|iPad|iPod/i.test(ua)) return false
  const probe = typeof Audio !== 'undefined' ? new Audio() : null
  return isHlsJsSupported() || canPlayNativeHls(probe)
}

export class QueueHlsPlayer {
  /**
   * @param {HTMLAudioElement} audio
   * @param {{ onTrackIndex?: (index: number) => void, onFatalError?: (detail: unknown) => void }} hooks
   */
  constructor(audio, hooks = {}) {
    this.audio = audio
    this.hooks = hooks
    this.hls = null
    this.nativeHls = false
    this.startIndex = 0
    this._onNativeTimeUpdate = null
    this._segmentStarts = []
  }

  get active() {
    return this.nativeHls || !!this.hls
  }

  destroy() {
    if (this._onNativeTimeUpdate) {
      this.audio.removeEventListener('timeupdate', this._onNativeTimeUpdate)
      this._onNativeTimeUpdate = null
    }
    if (this.hls) {
      this.hls.destroy()
      this.hls = null
    }
    this.nativeHls = false
    this._segmentStarts = []
  }

  /**
   * @param {number[]} segmentDurations seconds per playlist entry
   */
  _bindNativeTrackIndex(segmentDurations) {
    this._segmentStarts = []
    let acc = 0
    for (const d of segmentDurations) {
      this._segmentStarts.push(acc)
      acc += Number.isFinite(d) && d > 0 ? d : 1
    }
    this._onNativeTimeUpdate = () => {
      const t = this.audio.currentTime
      if (!Number.isFinite(t)) return
      let idx = 0
      for (let i = this._segmentStarts.length - 1; i >= 0; i--) {
        if (t >= this._segmentStarts[i] - 0.25) {
          idx = i
          break
        }
      }
      this.hooks.onTrackIndex?.(this.startIndex + idx)
    }
    this.audio.addEventListener('timeupdate', this._onNativeTimeUpdate)
  }

  /**
   * @param {string} playlistUrl absolute or root-relative
   * @param {{ authorization?: string, startIndex?: number, segmentDurations?: number[] }} opts
   */
  async load(playlistUrl, opts = {}) {
    this.destroy()
    this.startIndex = Number.isFinite(Number(opts.startIndex)) ? Number(opts.startIndex) : 0

    if (canPlayNativeHls(this.audio) && !isMediaSourceHlsCapable()) {
      this.nativeHls = true
      this.audio.src = playlistUrl
      if (Array.isArray(opts.segmentDurations) && opts.segmentDurations.length) {
        this._bindNativeTrackIndex(opts.segmentDurations)
      }
      return
    }

    const Hls = await loadHlsModule()
    if (!Hls.isSupported()) {
      if (canPlayNativeHls(this.audio)) {
        this.nativeHls = true
        this.audio.src = playlistUrl
        if (Array.isArray(opts.segmentDurations) && opts.segmentDurations.length) {
          this._bindNativeTrackIndex(opts.segmentDurations)
        }
        return
      }
      throw new Error('HLS_NOT_SUPPORTED')
    }

    this.hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      xhrSetup: (xhr, url) => {
        if (opts.authorization && String(url).includes('/api/stream/playlist')) {
          xhr.setRequestHeader('Authorization', opts.authorization)
        }
      },
    })

    this.hls.attachMedia(this.audio)
    this.hls.on(Hls.Events.FRAG_CHANGED, (_, data) => {
      const sn = data?.frag?.sn
      if (Number.isFinite(sn)) {
        this.hooks.onTrackIndex?.(this.startIndex + sn)
      }
    })
    this.hls.on(Hls.Events.ERROR, (_, data) => {
      if (data?.fatal) {
        this.hooks.onFatalError?.(data)
      }
    })
    this.hls.loadSource(playlistUrl)
  }
}
