<script setup>
import { ref, computed } from 'vue'
import { 
  ArrowLeft
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { usePlayerStore } from '@/stores/player'
import { useAuthStore } from '@/stores/auth'
import { useLibraryStore } from '@/stores/library'
import QueueList from './QueueList.vue'
import FullPlayerHeader from './FullPlayerHeader.vue'
import FullPlayerNowPlaying from './FullPlayerNowPlaying.vue'

// 💉 1. 공통 유틸리티 임포트
import { formatTrackTime } from '@/lib/audio'
import { getCoverUrl } from '@/lib/image'

const player = usePlayerStore()
const auth = useAuthStore()
const library = useLibraryStore()

const showMenu = ref(false)

const currentTrack = computed(() => player.currentTrack)

// 트랙 id만 있으면 URL 생성 — 이미지 API가 DB에서 앨범/커스텀 커버를 해석함
const coverUrl = computed(() => {
  if (!currentTrack.value?.id) return ''
  return auth.coverSrc('track', currentTrack.value.id)
})

// 💉 3. 로컬 formatTime 제거 -> lib/audio의 formatTrackTime 사용

// 💉 4. 아티스트 표시 로직 수정 (artist 필드 활용)
const displayArtist = computed(() => {
  return currentTrack.value?.artist || '아티스트 없음'
})

const toggleFavorite = async () => { 
  if (currentTrack.value) {
    await library.toggleTrackStar(currentTrack.value.id, !currentTrack.value.starred)
  }
  showMenu.value = false 
}

const changeRating = async (rate) => { 
  if (currentTrack.value) {
    await library.updateTrackRating(currentTrack.value.id, rate)
  }
  showMenu.value = false 
}
</script>

<template>
  <div class="relative w-full h-full flex flex-col bg-background text-foreground overflow-hidden">
    
    <div class="absolute inset-0 z-0 pointer-events-none">
      <img v-if="coverUrl" :src="coverUrl" crossorigin="anonymous" 
           class="w-full h-full object-cover blur-[100px] opacity-10 saturate-[0.5] scale-125" />
      <div class="absolute inset-0 bg-gradient-to-b from-background/20 via-background/80 to-background"></div>
    </div>

    <div class="relative z-10 flex flex-col h-full w-full">
      
      <FullPlayerHeader
        :player="player"
        :current-track="currentTrack"
        :show-menu="showMenu"
        :toggle-favorite="toggleFavorite"
        :change-rating="changeRating"
        @close="player.toggleExpand()"
        @toggle-menu="showMenu = !showMenu"
      />

      <main class="flex-1 flex flex-col items-stretch justify-center px-4 sm:px-6 md:px-12 max-w-6xl lg:max-w-7xl mx-auto w-full min-h-0 overflow-y-auto overflow-x-hidden pb-8 md:pb-12">
        <div class="w-full flex-1 flex flex-col justify-center min-h-0 py-2 md:py-4">
          <Transition name="slide-fade" mode="out-in">
            <FullPlayerNowPlaying
              v-if="!player.isQueueView"
              :player="player"
              :cover-url="coverUrl"
              :current-track="currentTrack"
              :display-artist="displayArtist"
              :format-track-time="formatTrackTime"
              :toggle-favorite="toggleFavorite"
              :change-rating="changeRating"
            />

            <div v-else class="flex flex-col h-full max-h-[500px] md:max-h-[600px] w-full relative min-h-0">
              <QueueList class="flex-1 min-h-0" />
              <Button 
                variant="secondary" 
                class="mt-4 rounded-full w-full py-6 font-black gap-2 border shadow-lg active:scale-95 transition-transform shrink-0"
                @click="player.toggleQueueView"
              >
                <ArrowLeft class="w-4 h-4" />
                <span>BACK TO PLAYER</span>
              </Button>
            </div>
          </Transition>

        </div>
      </main>

    </div>
  </div>
</template>

<style scoped>
/* 기존 스타일 유지 */
:deep(.relative.h-1\.5) { height: 8px; }
:deep([role="slider"]) { width: 18px; height: 18px; border: 4px solid white; }

h2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.slide-fade-enter-active, .slide-fade-leave-active { transition: all 0.3s ease-out; }
.slide-fade-enter-from { opacity: 0; transform: translateX(20px); }
.slide-fade-leave-to { opacity: 0; transform: translateX(-20px); }

.fade-scale-enter-active, .fade-scale-leave-active { transition: all 0.5s ease; }
.fade-scale-enter-from, .fade-scale-leave-to { opacity: 0; scale: 0.9; }
</style>