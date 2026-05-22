import { computed, unref, watchEffect } from 'vue'
import { useAuthStore } from '@/stores/auth'

/**
 * @param {'album'|'artist'|'track'|'playlist'|'tag'} type
 * @param {import('vue').MaybeRefOrGetter<string|undefined|null>} idSource
 */
export function useCoverUrl(type, idSource) {
  const auth = useAuthStore()
  const t = unref(type)

  watchEffect(() => {
    const id = typeof idSource === 'function' ? idSource() : unref(idSource)
    if (id && auth.token) void auth.ensureImageSignature(t, id)
  })

  return computed(() => {
    const id = typeof idSource === 'function' ? idSource() : unref(idSource)
    return auth.coverSrc(t, id)
  })
}
