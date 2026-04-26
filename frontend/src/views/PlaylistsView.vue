<script setup>
import { ref, onMounted } from 'vue'
import { usePlaylistStore } from '@/stores/playlist'
import PlaylistListTable from '@/components/playlist/PlaylistListTable.vue'

// 💡 1. 구형 PlaylistFormModal 대신 신형 PlaylistDialog로 교체!
import PlaylistDialog from '@/components/playlist/PlaylistDialog.vue' 

import ViewHeader from '@/components/shared/ViewHeader.vue'

const playlistStore = usePlaylistStore()
const isLoading = ref(true)

// 모달 제어 상태
const isDialogOpen = ref(false)
const selectedPlaylist = ref(null)

const openCreateModal = () => {
  selectedPlaylist.value = null // 생성 모드
  isDialogOpen.value = true
}

const openEditModal = async (playlist) => {
  // 만약 스마트 믹스라면 굳이 곡 목록을 가져올 필요가 없지만, 
  // 수동 리스트라면 반드시 곡 목록을 불러와야 탭에 표시됩니다.
  const detailedPlaylist = await playlistStore.fetchPlaylistDetails(playlist.id)
  
  // 불러온 상세 정보(tracks 포함)를 editTarget으로 꽂아줍니다!
  selectedPlaylist.value = detailedPlaylist || playlist 
  isDialogOpen.value = true
}

onMounted(async () => {
  isLoading.value = true
  await playlistStore.fetchPlaylists()
  isLoading.value = false
})
</script>

<template>
  <div class="w-full space-y-6 animate-in fade-in duration-500">
    <ViewHeader
      title="Playlists"
      :description="`내 플레이리스트 및 스마트 믹스 (${playlistStore.playlists.length}개)`"
      @action="openCreateModal"
    >
    </ViewHeader>

    <div v-if="!isLoading" class="bg-card overflow-hidden pb-4">
      <PlaylistListTable 
        :playlists="playlistStore.playlists" 
        @edit="openEditModal" 
      />
    </div>

    <PlaylistDialog 
      v-model:is-open="isDialogOpen" 
      :edit-target="selectedPlaylist"
      @success="playlistStore.fetchPlaylists()" 
    />
  </div>
</template>