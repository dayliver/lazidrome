<script setup>
import { ref, onMounted, watch } from 'vue'
import { useLibraryStore } from '@/stores/library'
import { useRequiresAuth } from '@/composables/useRequiresAuth'
import { Button } from '@/components/ui/button'
import TrackListTable from '@/components/shared/TrackListTable.vue'
import ViewHeader from '@/components/shared/ViewHeader.vue'
import AuthEmptyState from '@/components/shared/AuthEmptyState.vue'

const library = useLibraryStore()
const { showAuthEmpty } = useRequiresAuth()

const tracksData = ref([])
const isLoading = ref(true)
const isLoadMore = ref(false)

const offset = ref(0)
const limit = 50
const hasMore = ref(true)

const loadTracks = async (isAppend = false) => {
  if (showAuthEmpty.value) {
    tracksData.value = []
    isLoading.value = false
    hasMore.value = false
    return
  }
  if (!isAppend) isLoading.value = true
  else isLoadMore.value = true

  try {
    const page = await library.fetchTracksPage({
      offset: offset.value,
      limit,
    })

    if (page.items.length < limit) hasMore.value = false
    else hasMore.value = page.hasMore

    if (isAppend) {
      tracksData.value.push(...page.items)
    } else {
      tracksData.value = page.items
    }
  } catch (error) {
    console.error('트랙 데이터를 불러오는 중 에러 발생:', error)
    hasMore.value = false
  } finally {
    isLoading.value = false
    isLoadMore.value = false
  }
}

const initTracks = async () => {
  if (showAuthEmpty.value) {
    tracksData.value = []
    isLoading.value = false
    return
  }
  if (!library.trackCount && !library.isSyncing) {
    await library.fetchLibrary()
  }
  offset.value = 0
  hasMore.value = true
  await loadTracks()
}

onMounted(initTracks)

watch(showAuthEmpty, () => {
  void initTracks()
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
      title="곡"
      :description="`전체 ${library.trackCount}곡 · ${tracksData.length}곡 표시 중`"
      @action="handleCreateTrack"
    />

    <AuthEmptyState v-if="showAuthEmpty" />

    <div v-else-if="isLoading && tracksData.length === 0" class="p-16 text-center text-muted-foreground flex flex-col items-center gap-4">
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
