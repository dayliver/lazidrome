<script setup>
import { computed } from 'vue'
import { Play, Pause, SkipForward, SkipBack, Maximize2 } from 'lucide-vue-next'
import { usePlayerStore } from '@/stores/player'
import { useAuthStore } from '@/stores/auth'

// 💉 1. 이미지 유틸리티 임포트
import { getCoverUrl } from '@/lib/image'

const props = defineProps({
  isSidebarExpanded: { type: Boolean, default: true }
})

const player = usePlayerStore()
const auth = useAuthStore()
const currentTrack = computed(() => player.currentTrack)

// 트랙 id만 있으면 URL 생성 — 이미지 API가 DB에서 앨범/커스텀 커버를 해석함
const coverUrl = computed(() => {
  if (!currentTrack.value?.id) return ''
  return getCoverUrl(auth.serverUrl, 'track', currentTrack.value.id, auth.token)
})

// 💉 3. 아티스트 표시 로직 (DB에서 묶어서 보내주는 'artist' 필드 활용)
const displayArtist = computed(() => {
  return currentTrack.value?.artist || 'Unknown Artist'
})
</script>

<template>
  <div class="group w-full cursor-pointer"
       :class="[
         'fixed bottom-0 left-0 h-16 bg-background/95 backdrop-blur-xl border-t z-50', // 모바일
         'md:static md:h-20 md:bg-transparent md:border-none' // 데스크톱
       ]"
       @click="player.toggleExpand()">
       
    <div class="flex items-center h-full transition-all duration-300 ease-out"
         :class="[
           'w-full px-4', // 모바일/확장 공통
           !isSidebarExpanded 
             ? 'md:absolute md:left-0 md:bottom-0 md:h-20 md:w-20 md:group-hover:w-[320px] md:bg-card md:border md:border-l-0 md:rounded-r-3xl md:shadow-[10px_0_30px_rgba(0,0,0,0.3)] md:z-[100] md:overflow-hidden' 
             : 'md:w-full md:px-4'
         ]">
         
      <div class="absolute -top-[1px] left-0 right-0 h-[2px] bg-muted/30 overflow-hidden z-10"
           :class="[!isSidebarExpanded ? 'md:group-hover:opacity-100 md:opacity-0 transition-opacity' : '']">
        <div class="h-full bg-primary shadow-[0_0_8px_var(--primary)] transition-all duration-300" 
             :style="{ width: player.progress[0] + '%' }"></div>
      </div>

      <div class="shrink-0 flex items-center justify-center w-12 h-12 md:w-[3.2rem] md:h-[3.2rem] relative"
           :class="[!isSidebarExpanded ? 'md:ml-[0.6rem]' : '']"> 
        <div class="w-full h-full rounded-lg shadow-sm overflow-hidden bg-muted relative ring-1 ring-border">
          <img 
            v-if="coverUrl" 
            :src="coverUrl" 
            crossorigin="anonymous" 
            class="w-full h-full object-cover" 
            @error="(e) => e.target.style.display='none'"
          />
          <div v-else class="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground font-black">LAZI</div>

          <div v-if="player.isPlaying" class="absolute bottom-1 right-1 bg-black/60 backdrop-blur-md rounded p-1 flex items-end justify-center gap-[2px] w-[18px] h-[18px]">
            <div class="w-[2px] bg-white rounded-full animate-eq-1"></div>
            <div class="w-[2px] bg-white rounded-full animate-eq-2"></div>
            <div class="w-[2px] bg-white rounded-full animate-eq-3"></div>
          </div>
        </div>
      </div>

      <div class="flex items-center flex-1 min-w-0 pr-2 gap-2 transition-opacity duration-300"
           :class="[!isSidebarExpanded ? 'md:opacity-0 md:group-hover:opacity-100' : '']">
           
        <div class="flex flex-col min-w-0 flex-1 ml-3 whitespace-nowrap">
          <span class="text-sm font-bold truncate transition-colors" :class="player.isPlaying ? 'text-primary' : 'text-foreground'">
            {{ currentTrack?.title || '재생 대기 중' }}
          </span>
          <span class="text-xs text-muted-foreground truncate font-medium">
            {{ displayArtist }}
          </span>
        </div>

        <div class="flex items-center gap-1 shrink-0 ml-2">
          <button class="hidden md:flex w-9 h-9 items-center justify-center rounded-full hover:bg-muted transition-colors" @click.stop="player.prev()">
            <SkipBack class="w-4 h-4 fill-current" />
          </button>
          
          <button class="w-10 h-10 flex items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all active:scale-95" @click.stop="player.togglePlay()">
            <component :is="player.isPlaying ? Pause : Play" class="w-5 h-5 fill-current" />
          </button>
          
          <button class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors" @click.stop="player.next()">
            <SkipForward class="w-4 h-4 fill-current" />
          </button>

          <button class="hidden md:flex w-9 h-9 items-center justify-center rounded-full text-muted-foreground hover:text-primary transition-colors ml-1" v-if="!isSidebarExpanded">
            <Maximize2 class="w-4 h-4" />
          </button>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.animate-eq-1 { animation: eq 1s ease-in-out infinite 0s; }
.animate-eq-2 { animation: eq 1s ease-in-out infinite 0.2s; }
.animate-eq-3 { animation: eq 1s ease-in-out infinite 0.4s; }

@keyframes eq {
  0%, 100% { height: 4px; }
  50% { height: 10px; }
}
</style>