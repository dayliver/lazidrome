/**
 * Media Session helpers — keep browser lock-screen metadata out of the player store body.
 */

export function setMediaSessionPlaybackState(state) {
  if (typeof navigator === 'undefined' || !navigator.mediaSession) return
  navigator.mediaSession.playbackState = state
}

export function clearMediaSession() {
  if (typeof navigator === 'undefined' || !navigator.mediaSession) return
  navigator.mediaSession.metadata = null
  navigator.mediaSession.playbackState = 'none'
}

/**
 * @param {{
 *   title: string,
 *   artist: string,
 *   album?: string,
 *   artworkUrl?: string,
 *   playing: boolean,
 * }} opts
 */
export function applyMediaSessionMetadata(opts) {
  if (typeof navigator === 'undefined' || !navigator.mediaSession) return
  const { title, artist, album, artworkUrl, playing } = opts
  const artwork = artworkUrl ? [{ src: artworkUrl, sizes: '512x512', type: 'image/jpeg' }] : []
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
  navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'
}

/**
 * @param {{
 *   play: () => void,
 *   pause: () => void,
 *   prev: () => void,
 *   next: () => void,
 *   stop: () => void,
 * }} handlers
 * @returns {boolean} true if newly bound
 */
export function bindMediaSessionActionHandlers(handlers) {
  if (typeof navigator === 'undefined' || !navigator.mediaSession) return false
  try {
    navigator.mediaSession.setActionHandler('play', handlers.play)
    navigator.mediaSession.setActionHandler('pause', handlers.pause)
    navigator.mediaSession.setActionHandler('previoustrack', handlers.prev)
    navigator.mediaSession.setActionHandler('nexttrack', handlers.next)
    navigator.mediaSession.setActionHandler('stop', handlers.stop)
  } catch {
    /* optional handlers */
  }
  return true
}

/**
 * @param {{
 *   duration: number,
 *   position: number,
 *   playbackRate: number,
 * }} state
 */
export function setMediaSessionPositionState(state) {
  if (typeof navigator === 'undefined' || !navigator.mediaSession?.setPositionState) return
  const { duration, position, playbackRate } = state
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(position)) return
  try {
    navigator.mediaSession.setPositionState({
      duration,
      playbackRate,
      position: Math.min(Math.max(0, position), duration),
    })
  } catch {
    /* unsupported */
  }
}
