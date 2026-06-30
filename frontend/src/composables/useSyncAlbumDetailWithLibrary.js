import { onMounted, onUnmounted } from 'vue'
import { useLibraryStore } from '@/stores/library'

/**
 * 메타데이터 저장 후 Pinia `albums` 외에, 상세 화면 등에만 들고 있는 앨범 객체를 같은 id로 병합합니다.
 * @param {() => object | null | undefined} getAlbum
 */
export function useSyncAlbumDetailWithLibrary(getAlbum) {
  const library = useLibraryStore()
  let unsub = null

  onMounted(() => {
    unsub = library.subscribeAlbumExternalSync((row) => {
      const album = getAlbum()
      if (!album?.id || !row?.id || String(album.id) !== String(row.id)) return
      Object.assign(album, row)
    })
  })

  onUnmounted(() => {
    if (typeof unsub === 'function') unsub()
  })
}
