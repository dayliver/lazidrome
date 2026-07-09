import { notify } from '@/lib/notify'
import { i18n } from '@/i18n'

/** 핀 버전 — CDN URL과 package.json hls.js 버전을 맞출 것 */
export const HLS_JS_VERSION = '1.6.16'

const HLS_CDN_SCRIPT = `https://cdn.jsdelivr.net/npm/hls.js@${HLS_JS_VERSION}/dist/hls.min.js`
const HLS_CDN_WORKER = `https://cdn.jsdelivr.net/npm/hls.js@${HLS_JS_VERSION}/dist/hls.worker.js`

/** @type {Promise<typeof import('hls.js').default> | null} */
let hlsModulePromise = null
/** @type {'cdn' | 'light' | null} */
let hlsLoadSource = null
let cdnFailWarned = false

function warnCdnFailedOnce() {
  if (cdnFailWarned) return
  cdnFailWarned = true
  try {
    notify.warning(i18n.global.t('player.hlsCdnFailed'))
  } catch {
    notify.warning(
      'Could not load the continuous-playback helper from the CDN. Queue playback may be less reliable.',
    )
  }
}

/**
 * @returns {Promise<typeof import('hls.js').default>}
 */
function loadHlsFromCdn() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('HLS_CDN_NO_WINDOW'))
  }
  const existing = window.Hls
  if (existing) {
    hlsLoadSource = 'cdn'
    return Promise.resolve(existing)
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = HLS_CDN_SCRIPT
    script.async = true
    script.crossOrigin = 'anonymous'
    script.onload = () => {
      if (window.Hls) {
        hlsLoadSource = 'cdn'
        resolve(window.Hls)
      } else {
        reject(new Error('HLS_CDN_NO_GLOBAL'))
      }
    }
    script.onerror = () => reject(new Error('HLS_CDN_SCRIPT_ERROR'))
    document.head.appendChild(script)
  })
}

/**
 * @returns {Promise<typeof import('hls.js').default>}
 */
function loadHlsLightFromPackage() {
  return import('hls.js/light').then((m) => {
    hlsLoadSource = 'light'
    return m.default
  })
}

/**
 * CDN(full) 우선 → 실패 시 패키지 hls.light 폴백.
 * CDN 실패 시 sonner 경고(세션당 1회).
 */
export function loadHlsModule() {
  if (!hlsModulePromise) {
    hlsModulePromise = loadHlsFromCdn().catch((cdnErr) => {
      console.warn('hls.js CDN load failed, falling back to hls.light', cdnErr)
      warnCdnFailedOnce()
      return loadHlsLightFromPackage().catch((lightErr) => {
        hlsModulePromise = null
        hlsLoadSource = null
        throw lightErr
      })
    })
  }
  return hlsModulePromise
}

/** 모바일에서 재생 시작 시 미리 받아 두기 (큐 HLS 여부와 무관) */
export function prefetchHlsModule() {
  return loadHlsModule().catch((e) => {
    console.warn('hls.js prefetch failed', e)
    return null
  })
}

export function getHlsLoadSource() {
  return hlsLoadSource
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

export function isMobilePlaybackUa() {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

/**
 * @param {{ queueLength: number, isShuffle: boolean, repeatMode: string }} opts
 */
export function shouldPreferHlsQueue(opts) {
  if (typeof navigator === 'undefined') return false
  if (!opts || opts.queueLength < 2) return false
  if (opts.isShuffle) return false
  if (opts.repeatMode === 'one') return false
  if (!isMobilePlaybackUa()) return false
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

    const hlsConfig = {
      enableWorker: hlsLoadSource === 'cdn',
      lowLatencyMode: false,
      xhrSetup: (xhr, url) => {
        if (opts.authorization && String(url).includes('/api/stream/playlist')) {
          xhr.setRequestHeader('Authorization', opts.authorization)
        }
      },
    }
    if (hlsLoadSource === 'cdn') {
      hlsConfig.workerPath = HLS_CDN_WORKER
    }

    this.hls = new Hls(hlsConfig)

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
