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
    if (!id) return ''
    // serverUrl '' = 현재 오리진 기준 상대 URL (배포 시 설정 비움). falsy 로 차단하면 커버가 전부 사라짐.
    return getCoverUrl(auth.serverUrl ?? '', t, id, auth.token)
  })
}
