<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { usePlaybackSyncStore } from '@/stores/playbackSync.js'
import { useAuthStore } from '@/stores/auth'
import md5 from 'md5'
import { X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

const player = usePlayerStore()
const playbackSync = usePlaybackSyncStore()
const auth = useAuthStore()
const { t } = useI18n()

// 대기열 곡 클릭 시 재생
const playFromQueue = (index) => {
  if (playbackSync.shouldControlRemote()) {
    playbackSync.remotePlayAtIndex(index)
    return
  }
  void playbackSync.playTracks(player.queue, index)
}

// 💡 실제 커버 이미지를 불러오기 위한 인증 토큰 
const authQueryString = computed(() => {
  if (!auth.password || !auth.username) return ''
  const salt = Math.random().toString(36).substring(2, 15)
  const token = md5(auth.password + salt)
  return `u=${auth.username}&t=${token}&s=${salt}&v=1.16.1&c=NaviPWA`
})

// 곡별 커버 URL 반환 (리스트용이므로 용량 최소화 size=50)
const getCoverUrl = (coverId) => {
  if (!coverId) return null
  return `${auth.serverUrl}/rest/getCoverArt?id=${coverId}&size=50&${authQueryString.value}`
}
</script>

<template>
  <Transition name="fade">
    <div v-if="player.isQueueOpen" 
         class="fixed inset-0 bg-black/40 z-[60] backdrop-blur-sm"
         @click="player.isQueueOpen = false"></div>
  </Transition>

  <Transition name="slide">
    <div v-if="player.isQueueOpen" 
         class="fixed right-0 top-0 bottom-24 w-full md:w-[400px] bg-background border-l z-[70] shadow-2xl flex flex-col">
      
      <div class="p-4 border-b flex items-center justify-between bg-muted/30">
        <h2 class="font-bold text-lg">{{ t('player.queueWithCount', { count: player.queue.length }) }}</h2>
        <Button variant="ghost" size="icon" @click="player.isQueueOpen = false">
          <X class="w-5 h-5" />
        </Button>
      </div>

      <ScrollArea class="flex-1 p-2">
        <div v-for="(track, index) in player.queue" :key="track.id || index"
             @click="playFromQueue(index)"
             class="flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors group"
             :class="player.currentIndex === index ? 'bg-primary/10' : 'hover:bg-muted'">
          
          <div class="w-10 h-10 rounded overflow-hidden relative border shrink-0 bg-muted flex items-center justify-center">
             <img v-if="getCoverUrl(track.coverArt)" 
                  :src="getCoverUrl(track.coverArt)" 
                  crossorigin="anonymous"
                  class="w-full h-full object-cover" />
             <span v-else class="text-[10px] font-bold text-muted-foreground">{{ t('app.short') }}</span>

             <div v-if="player.currentIndex === index" class="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
               <div class="w-2 h-2 bg-primary animate-pulse rounded-full"></div>
             </div>
          </div>

          <div class="flex flex-col min-w-0">
            <span class="text-sm font-semibold truncate" :class="player.currentIndex === index ? 'text-primary' : ''">
              {{ track.title }}
            </span>
            <span class="text-xs text-muted-foreground truncate">
              {{ track.artist || track.albumArtist || track.composer || t('common.unknownArtist') }}
            </span>
          </div>
        </div>
      </ScrollArea>
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.slide-enter-active, .slide-leave-active { transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.slide-enter-from, .slide-leave-to { transform: translateX(100%); }
</style>