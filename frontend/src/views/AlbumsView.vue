<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLibraryStore } from '@/stores/library'
import { useAuthStore } from '@/stores/auth'
import { useRequiresAuth } from '@/composables/useRequiresAuth'
import { Disc } from 'lucide-vue-next'
import AlbumGrid from '@/components/shared/AlbumGrid.vue'
import ViewHeader from '@/components/shared/ViewHeader.vue'
import AuthEmptyState from '@/components/shared/AuthEmptyState.vue'

const { t } = useI18n()
const library = useLibraryStore()
const auth = useAuthStore()
const { showAuthEmpty } = useRequiresAuth()

const albumsData = ref([])
const isLoading = ref(true)

const description = computed(() =>
  t('pages.albums.description', { count: albumsData.value.length })
)

const loadAlbums = async () => {
  if (showAuthEmpty.value) {
    albumsData.value = []
    isLoading.value = false
    return
  }
  isLoading.value = true
  try {
    const data = await library.getAlbums()
    albumsData.value = data || []
    const coverIds = albumsData.value.filter((a) => a.cover_type).map((a) => a.id)
    if (coverIds.length) {
      await auth.prefetchImageSignatures('album', coverIds)
    }
  } catch (error) {
    console.error(error)
  } finally {
    isLoading.value = false
  }
}

onMounted(loadAlbums)

watch(showAuthEmpty, () => {
  void loadAlbums()
})

const handleCreateAlbum = () => {
  console.log('create album')
}
</script>

<template>
  <div class="w-full space-y-6">
    <ViewHeader
      :title="t('pages.albums.title')"
      :description="description"
      @action="handleCreateAlbum"
    />

    <AuthEmptyState v-if="showAuthEmpty" />

    <div v-else-if="isLoading" class="p-16 text-center text-muted-foreground flex flex-col items-center gap-4">
      <div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      <p>{{ t('pages.albums.loading') }}</p>
    </div>

    <div v-else-if="albumsData.length === 0" class="p-16 text-center text-muted-foreground flex flex-col items-center gap-4">
      <Disc class="w-12 h-12 opacity-20" />
      <p>{{ t('pages.albums.empty') }}</p>
    </div>

    <AlbumGrid v-else :albums="albumsData" />
  </div>
</template>
