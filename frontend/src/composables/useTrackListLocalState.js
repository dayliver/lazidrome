import { ref, watch } from 'vue'
import { usePlaylistStore } from '@/stores/playlist'

export function useTrackListLocalState(props) {
  const playlistStore = usePlaylistStore()
  const localTracks = ref([])

  watch(
    () => props.tracks,
    (newVal) => {
      localTracks.value = [...(newVal || [])]
    },
    { immediate: true }
  )

  const onDragEnd = async () => {
    if (!props.playlistId) return

    const reorderedItems = localTracks.value.map((track, index) => ({
      playlistTrackId: track.playlist_track_id,
      position: (index + 1) * 10
    }))

    await playlistStore.reorderTracks(props.playlistId, reorderedItems)
  }

  return { localTracks, onDragEnd }
}
