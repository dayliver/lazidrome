import { ref, watch, toValue } from 'vue'
import { usePlaylistStore } from '@/stores/playlist'

export function useTrackListLocalState(props) {
  const playlistStore = usePlaylistStore()
  const localTracks = ref([])

  watch(
    () => toValue(props).tracks,
    (newVal) => {
      localTracks.value = [...(newVal || [])]
    },
    { immediate: true, deep: true },
  )

  const onDragEnd = async () => {
    if (!toValue(props).playlistId) return

    const reorderedItems = localTracks.value.map((track, index) => ({
      playlistTrackId: track.playlist_track_id,
      position: (index + 1) * 10
    }))

    await playlistStore.reorderTracks(toValue(props).playlistId, reorderedItems)
  }

  return { localTracks, onDragEnd }
}
