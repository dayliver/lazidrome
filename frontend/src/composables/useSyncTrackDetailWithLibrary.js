import { onMounted, onUnmounted } from 'vue'
import { useLibraryStore } from '@/stores/library'

/**
 * 메타데이터 저장 후 Pinia `tracks` 외에, 상세 화면 등에만 들고 있는 트랙 객체를 같은 id로 병합합니다.
 * @param {() => object | null | undefined} getTrack
 */
export function useSyncTrackDetailWithLibrary(getTrack) {
  const library = useLibraryStore()
  let unsub = null

  onMounted(() => {
    unsub = library.subscribeTrackExternalSync((row) => {
      const track = getTrack()
      if (!track?.id || !row?.id || String(track.id) !== String(row.id)) return
      Object.assign(track, row)
    })
  })

  onUnmounted(() => {
    if (typeof unsub === 'function') unsub()
  })
}
