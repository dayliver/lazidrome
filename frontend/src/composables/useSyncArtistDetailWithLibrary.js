import { onMounted, onUnmounted } from 'vue'
import { useLibraryStore } from '@/stores/library'

/**
 * 메타데이터 저장 후 Pinia `artists` 외에, 상세 화면 등에만 들고 있는 아티스트 객체를 같은 id로 병합합니다.
 * @param {() => object | null | undefined} getArtist
 */
export function useSyncArtistDetailWithLibrary(getArtist) {
  const library = useLibraryStore()
  let unsub = null

  onMounted(() => {
    unsub = library.subscribeArtistExternalSync((row) => {
      const artist = getArtist()
      if (!artist?.id || !row?.id || String(artist.id) !== String(row.id)) return
      Object.assign(artist, row)
    })
  })

  onUnmounted(() => {
    if (typeof unsub === 'function') unsub()
  })
}
