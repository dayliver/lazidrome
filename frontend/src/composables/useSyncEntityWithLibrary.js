import { onMounted, onUnmounted } from 'vue'
import { useLibraryStore } from '@/stores/library'

/**
 * @param {'track' | 'album' | 'artist'} kind
 * @param {() => object | object[] | null | undefined} getTarget
 *   - object: merge into that entity when ids match
 *   - array: find row by id and merge
 */
export function useSyncEntityWithLibrary(kind, getTarget) {
  const library = useLibraryStore()
  let unsub = null

  const subscribe =
    kind === 'track'
      ? library.subscribeTrackExternalSync.bind(library)
      : kind === 'album'
        ? library.subscribeAlbumExternalSync.bind(library)
        : library.subscribeArtistExternalSync.bind(library)

  onMounted(() => {
    unsub = subscribe((row) => {
      if (!row?.id) return
      const target = getTarget()
      if (Array.isArray(target)) {
        const idx = target.findIndex((t) => t && String(t.id) === String(row.id))
        if (idx === -1) return
        Object.assign(target[idx], row)
        return
      }
      if (!target?.id || String(target.id) !== String(row.id)) return
      Object.assign(target, row)
    })
  })

  onUnmounted(() => {
    if (typeof unsub === 'function') unsub()
  })
}

/** @param {() => object | null | undefined} getTrack */
export function useSyncTrackDetailWithLibrary(getTrack) {
  return useSyncEntityWithLibrary('track', getTrack)
}

/** @param {() => unknown[] | null | undefined} getList */
export function useSyncTrackListWithLibrary(getList) {
  return useSyncEntityWithLibrary('track', getList)
}

/** @param {() => object | null | undefined} getAlbum */
export function useSyncAlbumDetailWithLibrary(getAlbum) {
  return useSyncEntityWithLibrary('album', getAlbum)
}

/** @param {() => object | null | undefined} getArtist */
export function useSyncArtistDetailWithLibrary(getArtist) {
  return useSyncEntityWithLibrary('artist', getArtist)
}
