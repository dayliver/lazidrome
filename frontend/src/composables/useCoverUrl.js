import { computed, unref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { getCoverUrl } from '@/lib/image'

/**
 * @param {'album'|'artist'|'track'|'playlist'|'tag'} type
 * @param {import('vue').MaybeRefOrGetter<string|undefined|null>} idSource
 */
export function useCoverUrl(type, idSource) {
  const auth = useAuthStore()
  const t = unref(type)

  return computed(() => {
    const id = typeof idSource === 'function' ? idSource() : unref(idSource)
    if (!id || !auth.serverUrl) return ''
    return getCoverUrl(auth.serverUrl, t, id, auth.token)
  })
}
