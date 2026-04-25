<script setup>
import { ref, onMounted } from 'vue'
import { useLibraryStore } from '@/stores/library'

// 💉 새로 만든 공유 컴포넌트 임포트
import ArtistListTable from '@/components/shared/ArtistListTable.vue'

const library = useLibraryStore()

const artistsData = ref([])
const isLoading = ref(true)

// 마운트 시 아티스트 통계 데이터 로드
onMounted(async () => {
  isLoading.value = true
  try {
    const data = await library.getArtists()
    artistsData.value = data || []
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="w-full space-y-6">
    <div class="flex items-end justify-between border-b pb-4">
      <h1 class="text-3xl font-black tracking-tight">Artists</h1>
      <p class="text-sm font-medium text-muted-foreground">총 {{ artistsData.length }}명의 아티스트</p>
    </div>

    <div class="bg-card rounded-lg overflow-hidden">
      <div v-if="isLoading" class="p-16 flex flex-col items-center gap-4 text-muted-foreground">
        <div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p>아티스트 통계 데이터를 분석하고 있습니다...</p>
      </div>
      
      <ArtistListTable v-else :artists="artistsData" />
      
    </div>
  </div>
</template>