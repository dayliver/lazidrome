<script setup>
import { ref, onMounted, watch } from 'vue'
import { useLibraryStore } from '@/stores/library'
import { useAuthStore } from '@/stores/auth'
import { useRequiresAuth } from '@/composables/useRequiresAuth'
import { Disc } from 'lucide-vue-next'
import AlbumGrid from '@/components/shared/AlbumGrid.vue'
import ViewHeader from '@/components/shared/ViewHeader.vue'
import AuthEmptyState from '@/components/shared/AuthEmptyState.vue'

const library = useLibraryStore()
const auth = useAuthStore()
const { showAuthEmpty } = useRequiresAuth()

const albumsData = ref([])
const isLoading = ref(true)

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
    console.error('앨범 데이터를 불러오는 중 에러 발생:', error)
  } finally {
    isLoading.value = false
  }
}

onMounted(loadAlbums)

watch(showAuthEmpty, () => {
  void loadAlbums()
})

const handleCreateAlbum = () => {
  console.log('새 앨범 생성')
}
</script>

<template>
  <div class="w-full space-y-6">
    
    <ViewHeader
      title="앨범"
      :description="`총 ${albumsData.length}장`"
      @action="handleCreateAlbum"
    />

    <AuthEmptyState v-if="showAuthEmpty" />

    <div v-else-if="isLoading" class="p-16 text-center text-muted-foreground flex flex-col items-center gap-4">
      <div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      <p>Lazidrome 엔진에서 앨범 갤러리를 구성하고 있습니다...</p>
    </div>
    
    <div v-else-if="albumsData.length === 0" class="p-16 text-center text-muted-foreground flex flex-col items-center gap-4">
      <Disc class="w-12 h-12 opacity-20" />
      <p>표시할 앨범이 없습니다.</p>
    </div>

    <AlbumGrid v-else :albums="albumsData" />

  </div>
</template>