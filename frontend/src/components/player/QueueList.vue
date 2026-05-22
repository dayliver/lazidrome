<script setup>
import { computed, nextTick, watch, ref } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { useAuthStore } from '@/stores/auth'
import { getCoverUrl } from '@/lib/image'
// 💉 수술 1: md5 제거
import { ScrollArea } from '@/components/ui/scroll-area'

const player = usePlayerStore()
const auth = useAuthStore()
const scrollAreaRef = ref(null)

const trackCoverSrc = (track) => {
  if (!track?.id) return ''
  return auth.coverSrc('track', track.id)
}

const playFromQueue = async (index) => {
  player.currentIndex = index
  await player.startPlayback()
}

// 현재 재생 중인 곡으로 자동 스크롤 (기존 로직 유지)
watch(() => player.isQueueView, (isOpen) => {
  if (isOpen) {
    nextTick(() => {
      const activeItem = document.querySelector('.queue-item-active')
      if (activeItem) activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }
})
</script>

<template>
  <div class="w-full h-full flex flex-col overflow-hidden bg-background/50 backdrop-blur-md rounded-3xl border border-white/10 shadow-2xl min-h-0">
    
    <div class="p-6 border-b border-white/10 flex justify-between items-center bg-muted/20 shrink-0">
      <h3 class="font-black text-xl tracking-tighter uppercase">Up Next</h3>
      <span class="text-xs font-bold text-muted-foreground bg-muted px-2 py-1 rounded">{{ player.queue.length }} Tracks</span>
    </div>

    <div class="flex-1 overflow-y-auto min-h-0 px-2 scroll-smooth" ref="scrollAreaRef">
      <div class="flex flex-col gap-1 py-4">
        
        <div v-for="(track, index) in player.queue" :key="track.id + index"
             @click="playFromQueue(index)"
             class="group flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all hover:bg-white/10 active:scale-[0.98]"
             :class="{ 'queue-item-active bg-primary/20': player.currentIndex === index }">
          
          <div class="w-6 text-center text-xs font-mono font-bold text-muted-foreground">
            <span v-if="player.currentIndex !== index" class="group-hover:hidden">{{ index + 1 }}</span>
            <div v-else class="flex justify-center gap-[2px] h-3 items-end">
              <div class="w-1 bg-primary animate-[bounce_1s_infinite_0s]"></div>
              <div class="w-1 bg-primary animate-[bounce_1s_infinite_0.2s]"></div>
              <div class="w-1 bg-primary animate-[bounce_1s_infinite_0.4s]"></div>
            </div>
          </div>

          <div class="w-12 h-12 rounded-lg overflow-hidden border border-white/5 bg-muted shrink-0">
            <img v-if="trackCoverSrc(track)" :src="trackCoverSrc(track)" crossorigin="anonymous" loading="lazy" class="w-full h-full object-cover" />
            <div v-else class="w-full h-full flex items-center justify-center text-[10px] font-black opacity-20">LAZI</div>
          </div>

          <div class="flex flex-col min-w-0 flex-1">
            <span class="text-sm font-bold truncate" :class="player.currentIndex === index ? 'text-primary' : ''">
              {{ track.title }}
            </span>
            <span class="text-xs text-muted-foreground truncate font-medium">
              {{ track.primary_artist || 'Unknown Artist' }}
            </span>
          </div>
          
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes bounce {
  0%, 100% { height: 4px; }
  50% { height: 12px; }
}
</style>