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

    <div
      v-else-if="isLoading"
      class="p-16 flex flex-col items-center gap-4 text-muted-foreground"
    >
      <div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      <p>{{ t('pages.playlists.loading') }}</p>
    </div>

    <div v-else class="bg-card overflow-hidden pb-4">
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
