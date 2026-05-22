<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Play, Pause, SkipForward, SkipBack, Maximize2 } from 'lucide-vue-next'
import { usePlayerStore } from '@/stores/player'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  isSidebarExpanded: { type: Boolean, default: true },
})

const player = usePlayerStore()
const auth = useAuthStore()
const { t } = useI18n()
const currentTrack = computed(() => player.currentTrack)

const coverUrl = computed(() => {
  if (!currentTrack.value?.id) return ''
  return auth.coverSrc('track', currentTrack.value.id)
})

const displayArtist = computed(() => currentTrack.value?.artist || t('player.noArtist'))

const coverAlt = computed(() => {
  const track = currentTrack.value
  if (!track?.title) return t('player.noTrackPlaying')
  return t('player.albumArtAlt', { title: track.title, artist: displayArtist.value })
})

function onPlayerKeydown(e) {
  if (e.target !== e.currentTarget) return
  switch (e.key) {
    case ' ':
    case 'k':
      e.preventDefault()
      player.togglePlay()
      break
    case 'ArrowRight':
    case 'n':
      e.preventDefault()
      player.next()
      break
    case 'ArrowLeft':
    case 'p':
      e.preventDefault()
      player.prev()
      break
    case 'Enter':
    case 'f':
      e.preventDefault()
      player.toggleExpand()
      break
    default:
      break
  }
}

</script>

<template>
  <div
    class="group w-full cursor-pointer"
    :class="[
      'fixed bottom-0 left-0 h-16 bg-background/95 backdrop-blur-xl border-t z-50',
      'md:static md:h-20 md:bg-transparent md:border-none',
    ]"
    role="region"
    :aria-label="t('player.miniPlayer')"
    tabindex="0"
    @keydown="onPlayerKeydown"
    @click="player.toggleExpand()"
  >
    <div
      class="flex items-center h-full transition-all duration-300 ease-out"
      :class="[
        'w-full px-4',
        !isSidebarExpanded
          ? 'md:absolute md:left-0 md:bottom-0 md:h-20 md:w-20 md:group-hover:w-[320px] md:bg-card md:border md:border-l-0 md:rounded-r-3xl md:shadow-[10px_0_30px_rgba(0,0,0,0.3)] md:z-[100] md:overflow-hidden'
          : 'md:w-full md:px-4',
      ]"
    >
      <div
        class="absolute -top-[1px] left-0 right-0 h-[2px] bg-muted/30 overflow-hidden z-10"
        :class="[!isSidebarExpanded ? 'md:group-hover:opacity-100 md:opacity-0 transition-opacity' : '']"
        aria-hidden="true"
      >
        <div
          class="h-full bg-primary shadow-[0_0_8px_var(--primary)] transition-all duration-300"
          :style="{ width: player.progress[0] + '%' }"
        />
      </div>

      <div
        class="shrink-0 flex items-center justify-center w-12 h-12 md:w-[3.2rem] md:h-[3.2rem] relative"
        :class="[!isSidebarExpanded ? 'md:ml-[0.6rem]' : '']"
      >
        <div class="w-full h-full rounded-lg shadow-sm overflow-hidden bg-muted relative ring-1 ring-border">
          <img
            v-if="coverUrl"
            :src="coverUrl"
            :alt="coverAlt"
            crossorigin="anonymous"
            class="w-full h-full object-cover"
            @error="(e) => (e.target.style.display = 'none')"
          />
          <div
            v-else
            class="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground font-black"
            aria-hidden="true"
          >
            {{ t('app.short') }}
          </div>

          <div
            v-if="player.isPlaying"
            class="absolute bottom-1 right-1 bg-black/60 backdrop-blur-md rounded p-1 flex items-end justify-center gap-[2px] w-[18px] h-[18px]"
            aria-hidden="true"
          >
            <div class="w-[2px] bg-white rounded-full animate-eq-1" />
            <div class="w-[2px] bg-white rounded-full animate-eq-2" />
            <div class="w-[2px] bg-white rounded-full animate-eq-3" />
          </div>
        </div>
      </div>

      <div
        class="flex items-center flex-1 min-w-0 pr-2 gap-2 transition-opacity duration-300"
        :class="[!isSidebarExpanded ? 'md:opacity-0 md:group-hover:opacity-100' : '']"
      >
        <div class="flex flex-col min-w-0 flex-1 ml-3 whitespace-nowrap">
          <span
            class="text-sm font-bold truncate transition-colors"
            :class="player.isPlaying ? 'text-primary' : 'text-foreground'"
          >
            {{ currentTrack?.title || t('player.waiting') }}
          </span>
          <span class="text-xs text-muted-foreground truncate font-medium">
            {{ displayArtist }}
          </span>
        </div>

        <div class="flex items-center gap-1 shrink-0 ml-2" role="group" :aria-label="t('player.playControls')">
          <button
            type="button"
            class="hidden md:flex w-9 h-9 items-center justify-center rounded-full hover:bg-muted transition-colors"
            :aria-label="t('player.previous')"
            @click.stop="player.prev()"
          >
            <SkipBack class="w-4 h-4 fill-current" aria-hidden="true" />
          </button>

          <button
            type="button"
            class="w-10 h-10 flex items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all active:scale-95"
            :aria-label="player.isPlaying ? t('player.pause') : t('player.play')"
            @click.stop="player.togglePlay()"
          >
            <component :is="player.isPlaying ? Pause : Play" class="w-5 h-5 fill-current" aria-hidden="true" />
          </button>

          <button
            type="button"
            class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
            :aria-label="t('player.next')"
            @click.stop="player.next()"
          >
            <SkipForward class="w-4 h-4 fill-current" aria-hidden="true" />
          </button>

          <button
            v-if="!isSidebarExpanded"
            type="button"
            class="hidden md:flex w-9 h-9 items-center justify-center rounded-full text-muted-foreground hover:text-primary transition-colors ml-1"
            :aria-label="t('player.fullscreen')"
            @click.stop="player.toggleExpand()"
          >
            <Maximize2 class="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-eq-1 {
  animation: eq 1s ease-in-out infinite 0s;
}
.animate-eq-2 {
  animation: eq 1s ease-in-out infinite 0.2s;
}
.animate-eq-3 {
  animation: eq 1s ease-in-out infinite 0.4s;
}

@keyframes eq {
  0%,
  100% {
    height: 4px;
  }
  50% {
    height: 10px;
  }
}
</style>
