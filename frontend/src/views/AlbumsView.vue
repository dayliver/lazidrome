<script setup>
import { ref, onMounted } from 'vue'
import { useLibraryStore } from '@/stores/library'
import { Disc } from 'lucide-vue-next'

// 💉 새로 만든 공유 컴포넌트 임포트
import AlbumGrid from '@/components/shared/AlbumGrid.vue'

const library = useLibraryStore()

const albumsData = ref([])
const isLoading = ref(true)

onMounted(async () => {
  isLoading.value = true
  try {
    const data = await library.getAlbums()
    albumsData.value = data || []
  } catch (error) {
    console.error("앨범 데이터를 불러오는 중 에러 발생:", error)
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="w-full space-y-6">
    
    <div class="flex items-end justify-between border-b pb-4">
      <h1 class="text-3xl font-black tracking-tight">Albums</h1>
      <p class="text-sm font-medium text-muted-foreground">
        총 {{ albumsData.length }}장
      </p>
    </div>

    <div v-if="isLoading" class="p-16 text-center text-muted-foreground flex flex-col items-center gap-4">
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