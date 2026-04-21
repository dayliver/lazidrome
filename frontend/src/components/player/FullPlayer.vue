<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { 
  ChevronDown, MoreVertical, Heart, Play, Pause, 
  SkipBack, SkipForward, Shuffle, Repeat, Repeat1, ListMusic, Star, ArrowLeft
} from 'lucide-vue-next'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { usePlayerStore } from '@/stores/player'
import { useAuthStore } from '@/stores/auth'
import { useLibraryStore } from '@/stores/library'
import QueueList from './QueueList.vue'

// 💉 1. 공통 유틸리티 임포트
import { formatTrackTime } from '@/lib/audio'
import { getCoverUrl } from '@/lib/image'

const player = usePlayerStore()
const auth = useAuthStore()
const library = useLibraryStore()

const showMenu = ref(false)
const windowWidth = ref(window.innerWidth)

const handleResize = () => { windowWidth.value = window.innerWidth }
onMounted(() => window.addEventListener('resize', handleResize))
onUnmounted(() => window.removeEventListener('resize', handleResize))

const currentTrack = computed(() => player.currentTrack)

// 💉 2. 이미지 URL 생성 로직을 새 유틸리티와 스키마에 맞춰 수정
const coverUrl = computed(() => {
  if (!currentTrack.value?.id) return ''
  
  // 트랙 자체 커버나 소속 앨범 커버 정보가 있을 때만 URL을 생성합니다.
  if (currentTrack.value.custom_cover_type || currentTrack.value.albumCoverType) {
    return getCoverUrl(auth.serverUrl, 'track', currentTrack.value.id, auth.token)
  }
  
  return ''
})

// 💉 3. 로컬 formatTime 제거 -> lib/audio의 formatTrackTime 사용

// 💉 4. 아티스트 표시 로직 수정 (artist 필드 활용)
const displayArtist = computed(() => {
  return currentTrack.value?.artist || 'Unknown Artist'
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
      
      <header class="flex justify-between items-center p-6 md:px-12 shrink-0">
        <Button variant="ghost" size="icon" class="rounded-full h-12 w-12" @click="player.toggleExpand()">
          <ChevronDown class="w-8 h-8" />
        </Button>
        <div class="flex flex-col items-center flex-1 px-4 text-center">
          <span class="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-1">
            {{ player.isQueueView ? 'Up Next' : 'Now Playing' }}
          </span>
          <span class="text-sm font-bold truncate max-w-[250px]">{{ currentTrack?.albumName || 'Lazidrome' }}</span>
        </div>
        
        <div class="relative">
          <Button variant="ghost" size="icon" class="rounded-full h-12 w-12" @click="showMenu = !showMenu">
            <MoreVertical class="w-6 h-6" />
          </Button>
          <div v-if="showMenu" class="absolute right-0 top-full mt-2 w-56 bg-card border rounded-2xl shadow-2xl overflow-hidden z-[130]">
            <button @click="toggleFavorite" class="w-full text-left px-5 py-4 text-sm font-semibold hover:bg-muted flex items-center gap-3">
              <Heart :class="currentTrack?.starred ? 'fill-red-500 text-red-500' : ''" class="w-4 h-4" />
              좋아요 {{ currentTrack?.starred ? '취소' : '추가' }}
            </button>
            <div class="px-5 py-4 border-t bg-muted/30">
              <span class="text-[10px] font-bold text-muted-foreground uppercase mb-3 block tracking-wider">평점 설정</span>
              <div class="flex justify-between">
                <button v-for="i in 5" :key="i" @click="changeRating(i)">
                  <Star class="w-6 h-6 transition-all active:scale-125" 
                        :class="i <= (currentTrack?.rating || 0) ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground/30'" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main class="flex-1 flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 px-6 md:px-12 max-w-7xl mx-auto w-full overflow-hidden pb-12">
        
        <Transition name="fade-scale">
          <div v-if="!player.isQueueView || windowWidth > 768" 
               class="w-full max-w-[320px] md:max-w-[480px] aspect-square shrink-0">
            <div class="w-full h-full rounded-2xl md:rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden border border-white/10 ring-1 ring-black/5 transition-all duration-700"
                 :class="player.isPlaying ? 'scale-100 shadow-primary/20' : 'scale-[0.92] opacity-80'">
              
              <img v-if="coverUrl" :src="coverUrl" crossorigin="anonymous" class="w-full h-full object-cover" />
              <div v-else class="w-full h-full bg-muted flex items-center justify-center text-4xl font-black text-muted-foreground/20 italic text-center px-8">
                LAZIDROME<br/><span class="text-lg opacity-50">NO COVER</span>
              </div>
            </div>
          </div>
        </Transition>

        <div class="flex flex-col w-full max-w-[400px] md:max-w-[500px] h-full justify-center min-h-0">
          
          <Transition name="slide-fade" mode="out-in">
            <div v-if="!player.isQueueView" class="flex flex-col gap-8 md:gap-10">
              <div class="text-center md:text-left space-y-2">
                <h2 class="text-3xl md:text-5xl font-black tracking-tighter leading-tight">{{ currentTrack?.title || '재생할 곡을 선택하세요' }}</h2>
                <p class="text-lg md:text-2xl text-muted-foreground font-medium opacity-80">{{ displayArtist }}</p>
              </div>

              <div class="space-y-3">
                <Slider v-model="player.progress" :max="100" :step="0.1" class="py-2" />
                <div class="flex justify-between text-xs font-mono font-bold text-muted-foreground tracking-tighter">
                  <span>{{ formatTrackTime(player.currentTime) }}</span>
                  <span>{{ formatTrackTime(player.duration) }}</span>
                </div>
              </div>

              <div class="flex flex-col gap-8">
                <div class="flex items-center justify-between px-2">
                  <Button variant="ghost" size="icon" @click="player.toggleShuffle" 
                          :class="player.isShuffle ? 'text-primary bg-primary/10' : 'text-muted-foreground/60'">
                    <Shuffle class="w-6 h-6" />
                  </Button>
                  
                  <div class="flex items-center gap-4 md:gap-8">
                    <Button variant="ghost" size="icon" class="h-14 w-14 rounded-full" @click="player.prev">
                      <SkipBack class="w-8 h-8 fill-current" />
                    </Button>
                    <Button variant="default" size="icon" class="h-20 w-20 md:h-24 md:w-24 rounded-full shadow-2xl bg-primary" @click="player.togglePlay">
                      <component :is="player.isPlaying ? Pause : Play" class="w-10 h-10 md:w-12 md:h-12 fill-current" />
                    </Button>
                    <Button variant="ghost" size="icon" class="h-14 w-14 rounded-full" @click="player.next">
                      <SkipForward class="w-8 h-8 fill-current" />
                    </Button>
                  </div>

                  <Button variant="ghost" size="icon" @click="player.toggleRepeat" 
                          :class="player.repeatMode !== 'off' ? 'text-primary bg-primary/10' : 'text-muted-foreground/60'">
                    <Repeat1 v-if="player.repeatMode === 'one'" class="w-6 h-6" />
                    <Repeat v-else class="w-6 h-6" />
                  </Button>
                </div>

                <div class="flex justify-center md:justify-start border-t pt-8 border-border/50">
                  <Button variant="outline" class="rounded-full px-6 py-6 gap-3 font-bold border-2" @click="player.toggleQueueView">
                    <ListMusic class="w-5 h-5" />
                    <span>Up Next</span>
                  </Button>
                </div>
              </div>
            </div>

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
:deep(.relative.h-1.5) { height: 8px; }
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