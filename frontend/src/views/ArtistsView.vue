<script setup>
import { ref, onMounted, watch } from 'vue'
import { useLibraryStore } from '@/stores/library'
import { useRequiresAuth } from '@/composables/useRequiresAuth'
import ArtistListTable from '@/components/shared/ArtistListTable.vue'
import ViewHeader from '@/components/shared/ViewHeader.vue'
import AuthEmptyState from '@/components/shared/AuthEmptyState.vue'

const library = useLibraryStore()
const { showAuthEmpty } = useRequiresAuth()

const artistsData = ref([])
const isLoading = ref(true)

const loadArtists = async () => {
  if (showAuthEmpty.value) {
    artistsData.value = []
    isLoading.value = false
    return
  }
  isLoading.value = true
  try {
    const data = await library.getArtists()
    artistsData.value = data || []
  } finally {
    isLoading.value = false
  }
}

onMounted(loadArtists)

watch(showAuthEmpty, () => {
  void loadArtists()
})

const handleCreateArtist = () => {
  console.log('새 아티스트 생성')
}
</script>

<template>
  <div class="w-full space-y-6">
    <ViewHeader
      title="아티스트"
      :description="`총 ${artistsData.length}명의 아티스트`"
      @action="handleCreateArtist"
    />

    <AuthEmptyState v-if="showAuthEmpty" />

    <div v-else class="bg-card rounded-lg overflow-hidden">
      <div v-if="isLoading" class="p-16 flex flex-col items-center gap-4 text-muted-foreground">
        <div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p>아티스트 목록을 불러오는 중…</p>
      </div>

      <ArtistListTable v-else :artists="artistsData" />
    </div>
  </div>
</template>
