<script setup>
import { ref, onMounted } from 'vue'
import { useLibraryStore } from '@/stores/library'
import ArtistListTable from '@/components/shared/ArtistListTable.vue'
import ViewHeader from '@/components/shared/ViewHeader.vue'

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

const handleCreateArtist = () => {
  console.log('새 아티스트 생성')
}
</script>

<template>
  <div class="w-full space-y-6">
    <ViewHeader
      title="Artists"
      :description="`총 ${artistsData.length}명의 아티스트`"
      @action="handleCreateArtist"
    />

    <div class="bg-card rounded-lg overflow-hidden">
      <div v-if="isLoading" class="p-16 flex flex-col items-center gap-4 text-muted-foreground">
        <div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p>아티스트 통계 데이터를 분석하고 있습니다...</p>
      </div>
      
      <ArtistListTable v-else :artists="artistsData" />
      
    </div>
  </div>
</template>