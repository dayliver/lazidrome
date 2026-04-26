import { onMounted, onUnmounted } from 'vue'
import { useLibraryStore } from '@/stores/library'

/**
 * 메타데이터 저장 후 Pinia `tracks` 외에, 상세 화면 등에만 들고 있는 트랙 배열 행을 같은 id로 병합합니다.
 * @param {() => unknown[] | undefined | null} getList - 트랙 객체 배열 (예: () => album.value?.tracks)
 */
export function useSyncTrackListWithLibrary(getList) {
  const library = useLibraryStore()
  let unsub = null

  onMounted(() => {
    unsub = library.subscribeTrackExternalSync((row) => {
      const list = getList()
      if (!Array.isArray(list) || !list.length || !row?.id) return
      const idx = list.findIndex((t) => t && String(t.id) === String(row.id))
      if (idx === -1) return
      Object.assign(list[idx], row)
    })
  })

  onUnmounted(() => {
    if (typeof unsub === 'function') unsub()
  })
}
