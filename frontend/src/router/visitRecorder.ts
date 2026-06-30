import type { Router } from 'vue-router'
import { recordVisit } from '@/lib/visitHistory'

/**
 * 상세·목록으로 이동할 때마다 방문 횟수를 누적해 홈 바로가기에 사용합니다.
 */
export function registerVisitRecorder(router: Router) {
  router.afterEach((to) => {
    switch (to.name) {
      case 'playlist-detail':
        if (to.params?.id) recordVisit({ type: 'playlist', id: String(to.params.id), name: '' })
        break
      case 'album-detail':
        if (to.params?.id) recordVisit({ type: 'album', id: String(to.params.id), name: '' })
        break
      case 'artist-detail':
        if (to.params?.id) recordVisit({ type: 'artist', id: String(to.params.id), name: '' })
        break
      case 'track-detail':
        if (to.params?.id) recordVisit({ type: 'track', id: String(to.params.id), name: '' })
        break
      case 'tag-detail':
        if (to.params?.name)
          recordVisit({ type: 'tag', id: String(to.params.name), name: String(to.params.name) })
        break
      default:
        break
    }
  })
}
