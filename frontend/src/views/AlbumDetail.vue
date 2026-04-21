<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useLibraryStore } from '@/stores/library'
import { useAuthStore } from '@/stores/auth'
import { usePlayerStore } from '@/stores/player'

// 💉 1. 공통 유틸리티 임포트
import { formatDuration } from '@/lib/audio'
import { getCoverUrl } from '@/lib/image'

import { Play, Shuffle, Users } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import DetailLayout from '@/components/layout/DetailLayout.vue'

// 💉 2. 우리가 만든 공유 컴포넌트 임포트!
import TrackListTable from '@/components/shared/TrackListTable.vue'
import ArtistListTable from '@/components/shared/ArtistListTable.vue'

const route = useRoute()
const library = useLibraryStore()
const auth = useAuthStore()
const player = usePlayerStore()

const album = ref(null)
const allArtists = ref([]) // 관련 아티스트 매칭을 위한 전체 데이터
const isLoading = ref(true)

// 💉 3. 유틸리티를 활용한 이미지 URL
const imageUrl = computed(() => {
  if (!album.value?.id) return ''
  return getCoverUrl(auth.serverUrl, 'album', album.value.id, auth.token)
})

// 💉 4. 핵심 로직: 앨범 트랙들에서 참여 아티스트를 추출하여 전체 아티스트 목록과 매칭합니다.
const albumArtists = computed(() => {
  if (!album.value?.tracks || !allArtists.value.length) return []
  
  const artistNames = new Set()
  album.value.tracks.forEach(t => {
    if (t.artist) {
      t.artist.split(', ').forEach(name => artistNames.add(name))
    }
  })
  
  // 전체 아티스트 중 이 앨범에 참여한 아티스트 객체만 필터링합니다.
  return allArtists.value.filter(a => artistNames.has(a.name))
})

onMounted(async () => {
  isLoading.value = true
  try {
    // 앨범 정보와 전체 아티스트 정보를 동시에 병렬로 가져옵니다.
    const [albumData, artistsData] = await Promise.all([
      library.getAlbumById(route.params.id),
      library.getArtists()
    ])
    album.value = albumData
    allArtists.value = artistsData || []
  } finally {
    isLoading.value = false
  }
})

const playSequential = () => {
  if (album.value?.tracks?.length > 0) {
    player.playNewQueue(album.value.tracks, 0)
  }
}

const playShuffle = () => {
  if (album.value?.tracks?.length > 0) {
    player.isShuffle = true
    player.playNewQueue(album.value.tracks, Math.floor(Math.random() * album.value.tracks.length))
  }
}
</script>

<template>
  <div v-if="isLoading" class="p-16 flex flex-col items-center gap-4 text-muted-foreground">
    <div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    <p>앨범 정보를 불러오고 있습니다...</p>
  </div>

  <DetailLayout v-else-if="album"
    :title="album.name"
    :subtitle="album.displayArtist || 'Unknown Artist'"
    :is-round-image="false"
    :image-url="imageUrl"
    :stats="[
      { label: '수록곡', value: album.tracks?.length || 0 },
      { label: '발매 연도', value: album.year || '-' },
      { label: '총 재생 시간', value: formatDuration(album.totalDuration) }
    ]"
  >
    
    <div class="flex items-center gap-4 mb-4 px-2">
      <Button @click="playSequential" class="rounded-full shadow-lg px-8">
        <Play class="w-4 h-4 mr-2 fill-current" /> 재생
      </Button>
      <Button @click="playShuffle" variant="outline" class="rounded-full px-8">
        <Shuffle class="w-4 h-4 mr-2" /> 셔플
      </Button>
    </div>

    <section class="space-y-4">
      <div class="bg-card border rounded-xl overflow-hidden shadow-sm">
        <TrackListTable 
          :tracks="album.tracks" 
          :show-album="false" 
          :show-cover="false" 
        />
      </div>
      <div v-if="album.tracks?.length > 0" class="px-2 text-[10px] text-muted-foreground opacity-50 text-right">
        총 {{ album.tracks.length }}곡 참여 • {{ formatDuration(album.totalDuration) }}
      </div>
    </section>

    <section v-if="albumArtists.length > 0" class="space-y-6 pb-12 mt-12">
      <div class="flex items-center gap-2 border-b pb-2">
        <Users class="w-6 h-6 text-primary" />
        <h2 class="text-2xl font-black tracking-tight">Featured Artists</h2>
      </div>
      <ArtistListTable :artists="albumArtists" />
    </section>

  </DetailLayout>

  <div v-else class="p-16 text-center text-muted-foreground">
    앨범 정보를 찾을 수 없습니다.
  </div>
</template>