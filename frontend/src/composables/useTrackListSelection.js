import { ref, computed } from 'vue'
import { usePlaylistStore } from '@/stores/playlist'
import { t } from '@/i18n/t'

export function useTrackListSelection(localTracks, props) {
  const playlistStore = usePlaylistStore()

  const selectedTrackIds = ref([])
  const isPlaylistModalOpen = ref(false)
  const tracksToAddToPlaylist = ref([])
  const isTagModalOpen = ref(false)
  const tracksToTag = ref([])

  const isAllSelected = computed(
    () => localTracks.value.length > 0 && selectedTrackIds.value.length === localTracks.value.length
  )
  const isSomeSelected = computed(
    () => selectedTrackIds.value.length > 0 && selectedTrackIds.value.length < localTracks.value.length
  )

  const toggleSelectAll = () => {
    if (isAllSelected.value) selectedTrackIds.value = []
    else selectedTrackIds.value = localTracks.value.map((t) => t.id)
  }

  const toggleSelect = (id) => {
    const idx = selectedTrackIds.value.indexOf(id)
    if (idx > -1) selectedTrackIds.value.splice(idx, 1)
    else selectedTrackIds.value.push(id)
  }

  const openPlaylistModal = (trackId = null) => {
    if (trackId) tracksToAddToPlaylist.value = [trackId]
    else tracksToAddToPlaylist.value = [...selectedTrackIds.value]
    isPlaylistModalOpen.value = true
  }

  const onPlaylistAddSuccess = () => {
    selectedTrackIds.value = []
  }

  // 태그 대화상자는 id가 아니라 곡 자체를 받는다 — 이미 붙어 있는 태그를 3단 상태로 보여줘야 하기 때문이다
  const openTagModal = (trackId = null) => {
    const ids = trackId ? [trackId] : selectedTrackIds.value
    tracksToTag.value = localTracks.value.filter((t) => ids.includes(t.id))
    isTagModalOpen.value = true
  }

  const onTagApplySuccess = () => {
    selectedTrackIds.value = []
  }

  const clearSelection = () => {
    selectedTrackIds.value = []
  }

  const removeTrackFromPlaylist = async (playlistTrackId, trackTitle) => {
    if (!props.playlistId || !playlistTrackId) return
    if (confirm(t('trackTable.removeFromPlaylistConfirm', { title: trackTitle }))) {
      await playlistStore.removeTrack(props.playlistId, playlistTrackId)
    }
  }

  const removeSelectedFromPlaylist = async () => {
    if (!props.playlistId) return
    if (confirm(t('trackTable.removeBulkConfirm', { count: selectedTrackIds.value.length }))) {
      const tracksToRemove = localTracks.value.filter(
        (t) => selectedTrackIds.value.includes(t.id) && t.playlist_track_id
      )
      await Promise.all(
        tracksToRemove.map((t) => playlistStore.removeTrack(props.playlistId, t.playlist_track_id))
      )
      selectedTrackIds.value = []
    }
  }

  return {
    selectedTrackIds,
    isPlaylistModalOpen,
    tracksToAddToPlaylist,
    isTagModalOpen,
    tracksToTag,
    isAllSelected,
    isSomeSelected,
    toggleSelectAll,
    toggleSelect,
    openPlaylistModal,
    onPlaylistAddSuccess,
    openTagModal,
    onTagApplySuccess,
    clearSelection,
    removeTrackFromPlaylist,
    removeSelectedFromPlaylist
  }
}
