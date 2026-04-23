<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlaylistStore } from '@/stores/playlist'
import { useAuthStore } from '@/stores/auth'
import { usePlayerStore } from '@/stores/player'

import { formatDuration } from '@/lib/audio'
import { getCoverUrl } from '@/lib/image'

import { Play, Shuffle, RefreshCw, ListMusic, Zap } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import DetailLayout from '@/components/layout/DetailLayout.vue'
import TrackListTable from '@/components/shared/TrackListTable.vue'

const route = useRoute()
const router = useRouter()
const playlistStore = usePlaylistStore()
const auth = useAuthStore()
const player = usePlayerStore()

const playlist = ref(null)
const isLoading = ref(true)
const isRefreshing = ref(false) // 믹스 다시 섞기용 로딩 상태

// 💡 1. 총 재생 시간 계산 (백엔드에서 주지 않으므로 트랙들의 duration을 합산)
const totalDuration = computed(() => {
  if (!playlist.value?.tracks) return 0
  return playlist.value.tracks.reduce((acc, track) => acc + (track.duration || 0), 0)
})

// 💡 2. 서브타이틀 동적 생성 (믹스 조건 또는 설명)
const subtitleText = computed(() => {
  if (!playlist.value) return ''
  if (playlist.value.type === 'list') {
    return playlist.value.description || '수동 플레이리스트'
  } else {
    if (playlist.value.description) return playlist.value.description
    if (playlist.value.rules && playlist.value.rules.conditions?.length > 0) {
      return playlist.value.rules.conditions.map(c => {
        const fieldName = c.field === 'rating' ? '별점' : c.field === 'tags' ? '태그' : c.field
        return `${fieldName} ${c.value}`
      }).join(' • ')
    }
    return '스마트 믹스'
  }
})

const imageUrl = computed(() => {
  if (!playlist.value?.id) return ''
  return getCoverUrl(auth.serverUrl, 'playlist', playlist.value.id, auth.token)
})

const fetchDetail = async () => {
  const data = await playlistStore.fetchPlaylistDetails(route.params.id)
  if (data) {
    playlist.value = data
  }
}

onMounted(async () => {
  isLoading.value = true
  await fetchDetail()
  isLoading.value = false
})

const playSequential = () => {
  if (playlist.value?.tracks?.length > 0) {
    player.playNewQueue(playlist.value.tracks, 0)
  }
}

const playShuffle = () => {
  if (playlist.value?.tracks?.length > 0) {
    player.isShuffle = true
    player.playNewQueue(playlist.value.tracks, Math.floor(Math.random() * playlist.value.tracks.length))
  }
}

// 💡 3. 스마트 믹스 전용: 곡 다시 섞기 기능!
const refreshMix = async () => {
  isRefreshing.value = true
  await fetchDetail()
  isRefreshing.value = false
}
</script>

<template>
  <div v-if="isLoading" class="p-16 flex flex-col items-center gap-4 text-muted-foreground">
    <div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    <p>플레이리스트를 불러오고 있습니다...</p>
  </div>

  <DetailLayout v-else-if="playlist"
    :title="playlist.name"
    :subtitle="subtitleText"
    :is-round-image="false"
    :image-url="imageUrl"
    :stats="[
      { label: '유형', value: playlist.type === 'mix' ? '스마트 믹스 ⚡' : '플레이리스트 🎵' },
      { label: '수록곡', value: playlist.tracks?.length || 0 },
      { label: '총 재생 시간', value: formatDuration(totalDuration) }
    ]"
  >
    
    <div class="flex items-center gap-4 mb-4 px-2">
      <Button @click="playSequential" class="rounded-full shadow-lg px-8">
        <Play class="w-4 h-4 mr-2 fill-current" /> 재생
      </Button>
      <Button @click="playShuffle" variant="outline" class="rounded-full px-8">
        <Shuffle class="w-4 h-4 mr-2" /> 셔플
      </Button>

      <Button 
        v-if="playlist.type === 'mix'" 
        @click="refreshMix" 
        variant="secondary" 
        class="rounded-full px-4 border shadow-sm transition-all hover:bg-purple-500 hover:text-white"
        :disabled="isRefreshing"
      >
        <RefreshCw class="w-4 h-4 mr-2" :class="{'animate-spin': isRefreshing}" /> 
        믹스 다시 섞기
      </Button>
    </div>

    <section class="space-y-4">
      <div class="bg-card border rounded-xl overflow-hidden shadow-sm">
        <TrackListTable 
          :tracks="playlist.tracks" 
          :show-album="true" 
          :show-cover="true" 
          :playlist-id="playlist.type === 'list' ? playlist.id : null"
        />
      </div>
      <div v-if="playlist.tracks?.length > 0" class="px-2 text-[10px] text-muted-foreground opacity-50 text-right">
        총 {{ playlist.tracks.length }}곡 • {{ formatDuration(totalDuration) }}
      </div>
    </section>

  </DetailLayout>

  <div v-else class="p-16 text-center text-muted-foreground flex flex-col items-center gap-4 border-2 border-dashed rounded-2xl m-8">
    <ListMusic class="w-12 h-12 opacity-20" />
    <h2 class="text-xl font-bold text-foreground">플레이리스트를 찾을 수 없습니다</h2>
    <p class="text-sm">삭제되었거나 접근할 수 없는 목록입니다.</p>
    <Button variant="outline" @click="router.push('/playlists')" class="mt-2">목록으로 돌아가기</Button>
  </div>
</template>