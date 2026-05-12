<script setup>
import { computed } from 'vue'
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, ListMusic, Heart, Star } from 'lucide-vue-next'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { splitTrailingParentheticals } from '@/lib/titleParts'

const props = defineProps({
  player: { type: Object, required: true },
  coverUrl: { type: String, default: '' },
  currentTrack: { type: Object, default: null },
  displayArtist: { type: String, required: true },
  formatTrackTime: { type: Function, required: true },
  toggleFavorite: { type: Function, required: true },
  changeRating: { type: Function, required: true }
})

const trackTitleParts = computed(() => splitTrailingParentheticals(props.currentTrack?.title))
</script>

<template>
  <div
    class="flex flex-col md:flex-row md:items-center gap-6 md:gap-10 lg:gap-14 w-full max-w-full"
  >
    <Transition name="fade-scale">
      <div
        class="w-[min(100%,18rem)] sm:w-[min(100%,20rem)] aspect-square shrink-0 mx-auto md:mx-0 md:w-56 md:h-56 lg:w-72 lg:h-72"
      >
        <div
          class="w-full h-full rounded-2xl md:rounded-3xl lg:rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden border border-white/10 ring-1 ring-black/5 transition-all duration-700"
          :class="player.isPlaying ? 'scale-100 shadow-primary/20' : 'scale-[0.98] md:scale-[0.96] opacity-90'"
        >
          <img
            v-if="coverUrl"
            :src="coverUrl"
            crossorigin="anonymous"
            class="w-full h-full object-cover"
            alt=""
          />
          <div
            v-else
            class="w-full h-full bg-muted flex items-center justify-center text-2xl sm:text-3xl md:text-4xl font-black text-muted-foreground/20 italic text-center px-6"
          >
            LAZIDROME<br /><span class="text-sm md:text-lg opacity-50">NO COVER</span>
          </div>
        </div>
      </div>
    </Transition>

    <div class="flex flex-col flex-1 min-w-0 gap-6 md:gap-8">
      <div class="text-center md:text-left space-y-2">
        <h2 class="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold tracking-tight leading-tight">
          <template v-if="currentTrack?.title">
            {{ trackTitleParts.main }}
            <span
              v-if="trackTitleParts.suffix"
              class="ms-2 sm:ms-2.5 md:ms-3 font-medium text-md sm:text-lg md:text-xl lg:text-2xl text-muted-foreground/95"
            >{{ trackTitleParts.suffix }}</span>
          </template>
          <template v-else>재생할 곡을 선택하세요</template>
        </h2>
        <p class="text-base sm:text-lg md:text-xl lg:text-2xl text-muted-foreground font-medium opacity-80">
          {{ displayArtist }}
        </p>
      </div>

      <div
        v-if="currentTrack?.id"
        class="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4 sm:gap-6"
      >
        <Button
          variant="ghost"
          size="icon"
          class="h-12 w-12 rounded-full shrink-0 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
          :aria-pressed="currentTrack.starred"
          @click="toggleFavorite()"
        >
          <Heart
            class="w-7 h-7"
            :class="currentTrack.starred ? 'fill-red-500 text-red-500' : ''"
          />
        </Button>
        <div class="flex items-center gap-1 sm:gap-2" role="group" aria-label="트랙 평점">
          <button
            v-for="i in 5"
            :key="i"
            type="button"
            class="p-1.5 rounded-md transition-transform active:scale-110 hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            @click="changeRating(i)"
          >
            <Star
              class="w-7 h-7 sm:w-8 sm:h-8"
              :class="i <= (currentTrack.rating || 0) ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground/35'"
            />
          </button>
        </div>
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

      <div class="flex justify-center md:justify-start border-t pt-6 md:pt-8 border-border/50">
        <Button variant="outline" class="rounded-full px-6 py-6 gap-3 font-bold border-2" @click="player.toggleQueueView">
          <ListMusic class="w-5 h-5" />
          <span>Up Next</span>
        </Button>
      </div>
    </div>
    </div>
  </div>
</template>
