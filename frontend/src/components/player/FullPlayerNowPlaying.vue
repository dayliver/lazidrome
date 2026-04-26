<script setup>
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, ListMusic } from 'lucide-vue-next'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'

defineProps({
  player: { type: Object, required: true },
  coverUrl: { type: String, default: '' },
  currentTrack: { type: Object, default: null },
  displayArtist: { type: String, required: true },
  formatTrackTime: { type: Function, required: true },
  windowWidth: { type: Number, required: true }
})
</script>

<template>
  <div class="flex flex-col gap-8 md:gap-10">
    <Transition name="fade-scale">
      <div v-if="windowWidth > 768" class="w-full max-w-[320px] md:max-w-[480px] aspect-square shrink-0">
        <div class="w-full h-full rounded-2xl md:rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden border border-white/10 ring-1 ring-black/5 transition-all duration-700"
             :class="player.isPlaying ? 'scale-100 shadow-primary/20' : 'scale-[0.92] opacity-80'">
          <img v-if="coverUrl" :src="coverUrl" crossorigin="anonymous" class="w-full h-full object-cover" />
          <div v-else class="w-full h-full bg-muted flex items-center justify-center text-4xl font-black text-muted-foreground/20 italic text-center px-8">
            LAZIDROME<br/><span class="text-lg opacity-50">NO COVER</span>
          </div>
        </div>
      </div>
    </Transition>

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
        <Button variant="ghost" size="icon" @click="player.toggleShuffle" :class="player.isShuffle ? 'text-primary bg-primary/10' : 'text-muted-foreground/60'">
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

        <Button variant="ghost" size="icon" @click="player.toggleRepeat" :class="player.repeatMode !== 'off' ? 'text-primary bg-primary/10' : 'text-muted-foreground/60'">
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
</template>
