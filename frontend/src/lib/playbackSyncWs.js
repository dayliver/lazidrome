export function emptyRemoteState() {
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

export function buildWsUrl(serverUrl, token) {
  const origin =
    serverUrl?.replace(/\/$/, '') ||
    (typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:5294')
  const wsOrigin = origin.replace(/^http/i, (m) => (m.toLowerCase() === 'https' ? 'wss' : 'ws'))
  return `${wsOrigin}/api/playback/ws?token=${encodeURIComponent(token)}`
}
