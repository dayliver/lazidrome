<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, ListMusic, Heart, Star, Radio, MonitorSpeaker } from 'lucide-vue-next'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { splitTrailingParentheticals } from '@/lib/titleParts'
import { usePlayerPresentation } from '@/composables/usePlayerPresentation.js'
import { formatTrackTime } from '@/lib/audio'
import ConnectedDevicesTrigger from '@/components/player/ConnectedDevicesTrigger.vue'
import { useAuthStore } from '@/stores/auth'

const {
  isRemote,
  currentTrack,
  coverUrl,
  isPlaying,
  currentTime,
  duration,
  isShuffle,
  repeatMode,
  canEditTrackMeta,
  remoteBadge,
  progress,
  togglePlay,
  next,
  prev,
  toggleShuffle,
  toggleRepeat,
  toggleQueueView,
  transferPlaybackHere,
  library,
} = usePlayerPresentation()

const { t } = useI18n()
const auth = useAuthStore()

const trackTitleParts = computed(() => splitTrailingParentheticals(currentTrack.value?.title))

async function onTransferHere() {
  await transferPlaybackHere()
}

async function toggleFavorite() {
  const tr = currentTrack.value
  if (tr?.id) await library.toggleTrackStar(tr.id, !tr.starred)
}

async function changeRating(rate) {
  const tr = currentTrack.value
  if (tr?.id) await library.updateTrackRating(tr.id, rate)
}
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
          :class="isPlaying ? 'scale-100 shadow-primary/20' : 'scale-[0.98] md:scale-[0.96] opacity-90'"
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
            {{ t('app.name') }}<br /><span class="text-sm md:text-lg opacity-50">{{ t('player.noCover').toUpperCase() }}</span>
          </div>
        </div>
      </div>
    </Transition>

    <div class="flex flex-col flex-1 min-w-0 gap-6 md:gap-8">
      <div
        v-if="isRemote || auth.isAuthenticated"
        class="flex flex-wrap items-center justify-center md:justify-start gap-2"
      >
        <template v-if="isRemote">
          <span class="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-bold uppercase tracking-wide text-primary">
            <Radio class="w-4 h-4 shrink-0" aria-hidden="true" />
            {{ t('player.remoteOnDevice', { device: remoteBadge }) }}
          </span>
          <Button variant="outline" size="sm" class="rounded-full gap-2 font-bold" @click="onTransferHere">
            <MonitorSpeaker class="w-4 h-4" />
            {{ t('player.playHere') }}
          </Button>
        </template>
        <ConnectedDevicesTrigger
          v-if="auth.isAuthenticated"
          variant="chip"
          popover-side="bottom"
          popover-align="start"
        />
      </div>

      <div class="text-center md:text-left space-y-2">
        <h2 class="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold tracking-tight leading-tight">
          <template v-if="currentTrack?.title">
            {{ trackTitleParts.main }}
            <span
              v-if="trackTitleParts.suffix"
              class="ms-2 sm:ms-2.5 md:ms-3 font-medium text-md sm:text-lg md:text-xl lg:text-2xl text-muted-foreground/95"
            >{{ trackTitleParts.suffix }}</span>
          </template>
          <template v-else>{{ t('player.selectTrack') }}</template>
        </h2>
        <p class="text-base sm:text-lg md:text-xl lg:text-2xl text-muted-foreground font-medium opacity-80">
          {{ currentTrack?.artist || t('player.noArtist') }}
        </p>
      </div>

      <div
        v-if="canEditTrackMeta"
        class="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4 sm:gap-6"
      >
        <Button
          variant="ghost"
          size="icon"
          class="h-12 w-12 rounded-full shrink-0 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
          :aria-pressed="currentTrack?.starred"
          @click="toggleFavorite()"
        >
          <Heart
            class="w-7 h-7"
            :class="currentTrack?.starred ? 'fill-red-500 text-red-500' : ''"
          />
        </Button>
        <div class="flex items-center gap-1 sm:gap-2" role="group" :aria-label="t('player.trackRating')">
          <button
            v-for="i in 5"
            :key="i"
            type="button"
            class="p-1.5 rounded-md transition-transform active:scale-110 hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            @click="changeRating(i)"
          >
            <Star
              class="w-7 h-7 sm:w-8 sm:h-8"
              :class="i <= (currentTrack?.rating || 0) ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground/35'"
            />
          </button>
        </div>
      </div>

    <div class="space-y-3">
      <Slider v-model="progress" :max="100" :step="0.1" class="py-2" />
      <div class="flex justify-between text-xs font-mono font-bold text-muted-foreground tracking-tighter">
        <span>{{ formatTrackTime(currentTime) }}</span>
        <span>{{ formatTrackTime(duration) }}</span>
      </div>
    </div>

    <div class="flex flex-col gap-8">
      <div class="flex items-center justify-between px-2">
        <Button variant="ghost" size="icon" @click="toggleShuffle()" :class="isShuffle ? 'text-primary bg-primary/10' : 'text-muted-foreground/60'">
          <Shuffle class="w-6 h-6" />
        </Button>

        <div class="flex items-center gap-4 md:gap-8">
          <Button variant="ghost" size="icon" class="h-14 w-14 rounded-full" @click="prev()">
            <SkipBack class="w-8 h-8 fill-current" />
          </Button>
          <Button variant="default" size="icon" class="h-20 w-20 md:h-24 md:w-24 rounded-full shadow-2xl bg-primary" @click="togglePlay()">
            <component :is="isPlaying ? Pause : Play" class="w-10 h-10 md:w-12 md:h-12 fill-current" />
          </Button>
          <Button variant="ghost" size="icon" class="h-14 w-14 rounded-full" @click="next()">
            <SkipForward class="w-8 h-8 fill-current" />
          </Button>
        </div>

        <Button variant="ghost" size="icon" @click="toggleRepeat()" :class="repeatMode !== 'off' ? 'text-primary bg-primary/10' : 'text-muted-foreground/60'">
          <Repeat1 v-if="repeatMode === 'one'" class="w-6 h-6" />
          <Repeat v-else class="w-6 h-6" />
        </Button>
      </div>

      <div class="flex justify-center md:justify-start border-t pt-6 md:pt-8 border-border/50">
        <Button variant="outline" class="rounded-full px-6 py-6 gap-3 font-bold border-2" @click="toggleQueueView()">
          <ListMusic class="w-5 h-5" />
          <span>{{ t('player.upNext') }}</span>
        </Button>
      </div>
    </div>
    </div>
  </div>
</template>
