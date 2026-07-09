<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlaylistStore } from '@/stores/playlist'
import { useRequiresAuth } from '@/composables/useRequiresAuth'
import PlaylistListTable from '@/components/playlist/PlaylistListTable.vue'
import PlaylistDialog from '@/components/playlist/PlaylistDialog.vue'
import ViewHeader from '@/components/shared/ViewHeader.vue'
import PageLayout from '@/components/layout/PageLayout.vue'
import AuthEmptyState from '@/components/shared/AuthEmptyState.vue'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'

const { t } = useI18n()
const playlistStore = usePlaylistStore()
const { showAuthEmpty } = useRequiresAuth()
const isLoading = ref(true)

const isDialogOpen = ref(false)
const selectedPlaylist = ref(null)

const description = computed(() =>
  t('pages.playlists.description', { count: playlistStore.playlists.length })
)

const openCreateModal = () => {
  selectedPlaylist.value = null
  isDialogOpen.value = true
}

const openEditModal = async (playlist) => {
  const detailedPlaylist = await playlistStore.fetchPlaylistDetails(playlist.id)
  selectedPlaylist.value = detailedPlaylist || playlist
  isDialogOpen.value = true
}

const loadPlaylists = async () => {
  if (showAuthEmpty.value) {
    isLoading.value = false
    return
  }
  isLoading.value = true
  await playlistStore.fetchPlaylists()
  isLoading.value = false
}

onMounted(loadPlaylists)

watch(showAuthEmpty, () => {
  void loadPlaylists()
})
</script>

<template>
  <PageLayout>
    <ViewHeader
      :title="t('pages.playlists.title')"
      :description="description"
      @action="openCreateModal"
    />

    <AuthEmptyState v-if="showAuthEmpty" />

    <LoadingSpinner v-else-if="isLoading" :label="t('pages.playlists.loading')" />

    <div v-else class="bg-card overflow-hidden pb-4 rounded-xl border">
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
  </PageLayout>
</template>
