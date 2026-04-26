<script setup>
import { ref, onMounted } from 'vue'
import { useLibraryStore } from '@/stores/library'
import { Button } from '@/components/ui/button'
import TrackListTable from '@/components/shared/TrackListTable.vue'
import ViewHeader from '@/components/shared/ViewHeader.vue'

const library = useLibraryStore()

const tracksData = ref([])
const isLoading = ref(true)
const isLoadMore = ref(false)

const offset = ref(0)
const limit = 50
const hasMore = ref(true)

const loadTracks = async (isAppend = false) => {
  if (!isAppend) isLoading.value = true
  else isLoadMore.value = true

  try {
    const allTracks = await library.getTracks()
    
    if (!Array.isArray(allTracks)) {
      console.error("서버에서 올바른 트랙 배열을 받지 못했습니다.")
      hasMore.value = false
      return
    }
    
    const newTracks = allTracks.slice(offset.value, offset.value + limit)
    
    if (newTracks.length < limit) hasMore.value = false
    
    if (isAppend) {
      tracksData.value.push(...newTracks)
    } else {
      tracksData.value = newTracks
    }
  } catch (error) {
    console.error("트랙 데이터를 불러오는 중 에러 발생:", error)
  } finally {
    isLoading.value = false
    isLoadMore.value = false
  }
}

onMounted(() => {
  offset.value = 0
  hasMore.value = true
  loadTracks()
})

const handleLoadMore = () => {
  offset.value += limit
  loadTracks(true)
}

const handleCreateTrack = () => {
  console.log('새 음원 업로드')
}
</script>

<template>
  <div class="w-full space-y-6">
    
    <ViewHeader
      title="Tracks"
      :description="`조회된 전체 트랙 (${tracksData.length}곡 로드됨)`"
      @action="handleCreateTrack"
    />

    <div v-if="isLoading && tracksData.length === 0" class="p-16 text-center text-muted-foreground flex flex-col items-center gap-4">
      <div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      <p>Lazidrome에서 곡 목록을 가져오고 있습니다...</p>
    </div>

    <div v-else class="bg-card overflow-hidden pb-4">
      
      <TrackListTable :tracks="tracksData" />

      <div v-if="hasMore" class="p-6 flex justify-center border-t mt-4">
        <Button variant="outline" class="w-full max-w-sm rounded-full bg-background" @click="handleLoadMore" :disabled="isLoadMore">
          <span v-if="isLoadMore" class="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2"></span>
          {{ isLoadMore ? '불러오는 중...' : '50곡 더 불러오기' }}
        </Button>
      </div>
      <div v-else-if="tracksData.length > 0" class="p-8 text-center text-xs text-muted-foreground">
        모든 트랙을 불러왔습니다.
      </div>

    </div>
  </div>
</template>