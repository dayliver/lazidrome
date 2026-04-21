<script setup>
import { computed } from 'vue'
import { Play, Pause, SkipBack, SkipForward, Volume2, ListMusic, Shuffle, Repeat, Repeat1 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { usePlayerStore } from '@/stores/player'
import { useAuthStore } from '@/stores/auth'
import md5 from 'md5'

const player = usePlayerStore()
const auth = useAuthStore()

const currentTrack = computed(() => player.currentTrack)

const coverUrl = computed(() => {
  if (!currentTrack.value?.coverArt) return ''
  const salt = Math.random().toString(36).substring(2, 15)
  const token = md5(auth.password + salt)
  return `${auth.serverUrl}/rest/getCoverArt?id=${currentTrack.value.coverArt}&size=150&u=${auth.username}&t=${token}&s=${salt}&v=1.16.1&c=NaviPWA`
})

const volumeModel = computed({
  get: () => [player.volume],
  set: (val) => player.volume = val[0]
})

const formatTime = (seconds) => {
  if (!seconds) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
</script>

<template>
  <div class="flex flex-col border-t bg-background/95 backdrop-blur-lg fixed bottom-0 w-full z-50">

    <div class="px-0 py-0">
      <Slider v-model="player.progress" :max="100" :step="0.1" class="cursor-pointer" />
    </div>

    <div class="flex items-center justify-between px-4 py-3 h-20">
      <div class="flex items-center gap-3 flex-1 min-w-0">
        <div class="h-12 w-12 rounded border overflow-hidden bg-muted flex-shrink-0">
          <img v-if="coverUrl" :src="coverUrl" crossorigin="anonymous" class="w-full h-full object-cover" />
        </div>
        <div class="flex flex-col min-w-0">
          <span class="text-sm font-bold truncate">{{ currentTrack?.title || '재생 중인 곡 없음' }}</span>
          <span class="text-xs text-muted-foreground truncate">{{ currentTrack?.artist || currentTrack?.albumArtist || '아티스트' }}</span>
        </div>
      </div>

      <div class="flex flex-col items-center flex-1">
        <div class="flex items-center gap-1 md:gap-4">
          <Button variant="ghost" size="icon" @click="player.toggleShuffle" 
                  :class="player.isShuffle ? 'text-primary' : 'text-muted-foreground'">
            <Shuffle class="w-4 h-4" />
          </Button>

          <Button variant="ghost" size="icon" @click="player.prev"><SkipBack class="w-5 h-5 fill-current" /></Button>
          
          <Button variant="default" size="icon" class="rounded-full h-10 w-10" @click="player.togglePlay">
            <component :is="player.isPlaying ? Pause : Play" class="w-5 h-5 fill-current" />
          </Button>
          
          <Button variant="ghost" size="icon" @click="player.next"><SkipForward class="w-5 h-5 fill-current" /></Button>

          <Button variant="ghost" size="icon" @click="player.toggleRepeat"
                  :class="player.repeatMode !== 'off' ? 'text-primary' : 'text-muted-foreground'">
            <Repeat1 v-if="player.repeatMode === 'one'" class="w-4 h-4" />
            <Repeat v-else class="w-4 h-4" />
          </Button>
        </div>
        <div class="text-[10px] text-muted-foreground font-mono mt-1">
          {{ formatTime(player.currentTime) }} / {{ formatTime(player.duration) }}
        </div>
      </div>

      <div class="hidden md:flex items-center justify-end gap-3 flex-1">
        <div class="flex items-center gap-2 w-28">
          <Volume2 class="w-4 h-4 text-muted-foreground" />
          <Slider v-model="volumeModel" :max="100" />
        </div>
        <Button variant="ghost" size="icon" @click="player.isQueueOpen = !player.isQueueOpen"
                :class="player.isQueueOpen ? 'text-primary bg-primary/10' : ''">
          <ListMusic class="w-5 h-5" />
        </Button>
      </div>
    </div>
  </div>
</template>