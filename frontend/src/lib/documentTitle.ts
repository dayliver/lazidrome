export const APP_NAME = 'Lazidrome'

export function formatAppTitle(pageTitle: string): string {
  const trimmed = String(pageTitle ?? '').trim()
  return trimmed ? `${trimmed} · ${APP_NAME}` : APP_NAME
}

export function formatTrackDocumentTitle(title: string, artist: string): string {
  const trackTitle = String(title ?? '').trim() || 'Unknown'
  const artistName = String(artist ?? '').trim() || 'Unknown Artist'
  return `${trackTitle} - ${artistName}`
}

export function formatArtistDocumentTitle(name: string): string {
  const trimmed = String(name ?? '').trim()
  return trimmed || APP_NAME
}

export function formatPlaylistDocumentTitle(name: string): string {
  const trimmed = String(name ?? '').trim()
  return trimmed || APP_NAME
}

export function formatTagDocumentTitle(name: string): string {
  const trimmed = String(name ?? '').trim()
  return trimmed || APP_NAME
}

function upsertMeta(attr: 'property' | 'name', key: string, content: string) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

export function setDocumentTitle(title: string) {
  const value = String(title ?? '').trim() || APP_NAME
  document.title = value
  upsertMeta('property', 'og:title', value)
  upsertMeta('name', 'twitter:title', value)
}
