import { computed } from 'vue'
import { useBreakpoints, breakpointsTailwind } from '@vueuse/core'

/** AlbumGrid / ArtistGrid와 동일한 브레이크포인트 열 수 */
export function useGridColumns() {
  const breakpoints = useBreakpoints(breakpointsTailwind)

  return computed(() => {
    if (breakpoints.greaterOrEqual('xl').value) return 6
    if (breakpoints.greaterOrEqual('lg').value) return 5
    if (breakpoints.greaterOrEqual('md').value) return 4
    if (breakpoints.greaterOrEqual('sm').value) return 3
    return 2
  })
}
