/** @typedef {'home'|'artists'|'albums'|'tracks'|'upload'|'files'|'tags'|'playlists'|'charts'|'history'|'stats'|'admin'|'settings'} NavItemId */

export const NAV_PINNED_KEY = 'lazidrome.nav.pinned'

/** @type {{ id: NavItemId, path: string, titleKey: string, defaultPinned: boolean }[]} */
export const NAV_ITEM_DEFS = [
  { id: 'home', path: '/', titleKey: 'nav.home', defaultPinned: true },
  { id: 'artists', path: '/artists', titleKey: 'nav.artists', defaultPinned: true },
  { id: 'albums', path: '/albums', titleKey: 'nav.albums', defaultPinned: true },
  { id: 'tracks', path: '/tracks', titleKey: 'nav.tracks', defaultPinned: true },
  { id: 'playlists', path: '/playlists', titleKey: 'nav.playlists', defaultPinned: true },
  { id: 'charts', path: '/charts', titleKey: 'nav.charts', defaultPinned: true },
  { id: 'upload', path: '/upload', titleKey: 'nav.upload', defaultPinned: false },
  { id: 'files', path: '/files', titleKey: 'nav.files', defaultPinned: false },
  { id: 'tags', path: '/tags', titleKey: 'nav.tags', defaultPinned: false },
  { id: 'history', path: '/history', titleKey: 'nav.history', defaultPinned: false },
  { id: 'stats', path: '/stats', titleKey: 'nav.stats', defaultPinned: false },
  { id: 'admin', path: '/admin', titleKey: 'nav.admin', defaultPinned: false },
  { id: 'settings', path: '/settings', titleKey: 'nav.settings', defaultPinned: true },
]

const ALL_IDS = NAV_ITEM_DEFS.map((d) => d.id)

/** @returns {NavItemId[]} */
export function defaultPinnedNavIds() {
  return NAV_ITEM_DEFS.filter((d) => d.defaultPinned).map((d) => d.id)
}

/** @param {unknown} raw @returns {NavItemId[]|null} */
function parseStoredPinned(raw) {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    const ids = parsed.filter((id) => ALL_IDS.includes(id))
    if (!ids.includes('home')) ids.unshift('home')
    return [...new Set(ids)]
  } catch {
    return null
  }
}

/** @returns {NavItemId[]} */
export function readPinnedNavIds() {
  if (typeof localStorage === 'undefined') return defaultPinnedNavIds()
  return parseStoredPinned(localStorage.getItem(NAV_PINNED_KEY)) ?? defaultPinnedNavIds()
}

/** @param {NavItemId[]} ids */
export function writePinnedNavIds(ids) {
  const next = [...new Set(ids.filter((id) => ALL_IDS.includes(id)))]
  if (!next.includes('home')) next.unshift('home')
  localStorage.setItem(NAV_PINNED_KEY, JSON.stringify(next))
}

/** @param {NavItemId[]} pinnedIds @returns {{ pinned: typeof NAV_ITEM_DEFS, overflow: typeof NAV_ITEM_DEFS }} */
export function splitNavItems(pinnedIds) {
  const pinnedSet = new Set(pinnedIds)
  const pinned = []
  const overflow = []
  for (const id of pinnedIds) {
    const def = NAV_ITEM_DEFS.find((d) => d.id === id)
    if (def) pinned.push(def)
  }
  for (const def of NAV_ITEM_DEFS) {
    if (!pinnedSet.has(def.id)) overflow.push(def)
  }
  return { pinned, overflow }
}
