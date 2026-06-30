<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Play, Pause, SkipForward, SkipBack, Maximize2, Radio } from 'lucide-vue-next'
import { usePlayerStore } from '@/stores/player'
import { usePlaybackSyncStore } from '@/stores/playbackSync.js'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  isSidebarExpanded: { type: Boolean, default: true },
})

const player = usePlayerStore()
const sync = usePlaybackSyncStore()
const auth = useAuthStore()
const { t } = useI18n()

const currentTrack = computed(() => sync.displayTrack)

const coverUrl = computed(() => {
  const id = currentTrack.value?.id
  if (!id) return ''
  return auth.coverSrc('track', id)
})

const displayArtist = computed(() => currentTrack.value?.artist || t('player.noArtist'))

const isPlaying = computed(() => sync.displayIsPlaying)

const progressPercent = computed(() => sync.displayProgress)

const remoteBadge = computed(() => {
  if (!sync.isRemoteMode || !sync.masterDeviceName) return ''
  return t('player.remoteOnDevice', { device: sync.masterDeviceName })
})

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
      sync.remoteTogglePlay()
      break
    case 'ArrowRight':
    case 'n':
      e.preventDefault()
      sync.remoteNext()
      break
    case 'ArrowLeft':
    case 'p':
      e.preventDefault()
      sync.remotePrev()
      break
    case 'Enter':
    case 'f':
      e.preventDefault()
      if (currentTrack.value?.id || sync.isRemoteMode) player.toggleExpand()
      break
    default:
      break
  }
}

function onMiniPlayerClick(e) {
  if (e.target.closest('[data-mini-player-action]')) return
  if (currentTrack.value?.id || sync.isRemoteMode) player.toggleExpand()
}
</script>

<template>
  <div
    class="mini-player group w-full cursor-pointer"
    :class="[
      'fixed bottom-0 left-0 z-50 border-t bg-background/95 backdrop-blur-xl',
      'min-h-[5.75rem]',
      'md:static md:border-none md:bg-transparent',
      isSidebarExpanded ? 'md:min-h-[7.25rem]' : 'md:min-h-[5rem]',
    ]"
    role="region"
    :aria-label="t('player.miniPlayer')"
    tabindex="0"
    @keydown="onPlayerKeydown"
    @click="onMiniPlayerClick"
  >
    <div
      class="mini-player__shell relative flex h-full w-full flex-col transition-all duration-300 ease-out"
      :class="[
        isSidebarExpanded ? 'px-3 py-2.5 md:px-3.5 md:py-3' : 'px-3 py-2',
        !isSidebarExpanded
          ? 'md:absolute md:bottom-0 md:left-0 md:h-[7.5rem] md:w-[7.5rem] md:overflow-hidden md:rounded-r-3xl md:border md:border-l-0 md:bg-card md:shadow-[10px_0_30px_rgba(0,0,0,0.3)] md:group-hover:h-auto md:group-hover:min-h-[7.25rem] md:group-hover:w-[min(100%,22.5rem)]'
          : '',
      ]"
    >
      <div
        class="absolute inset-x-0 top-0 z-10 h-[2px] overflow-hidden bg-muted/30"
        :class="[!isSidebarExpanded ? 'md:opacity-0 md:group-hover:opacity-100 transition-opacity' : '']"
        aria-hidden="true"
      >
        <div
          class="h-full bg-primary shadow-[0_0_8px_var(--primary)] transition-all duration-300"
          :style="{ width: progressPercent + '%' }"
        />
      </div>

      <!-- collapsed sidebar: cover-only until hover -->
      <div
        v-if="!isSidebarExpanded"
        class="hidden md:flex md:h-full md:w-full md:items-center md:justify-center md:group-hover:hidden"
      >
        <div class="relative h-12 w-12 overflow-hidden rounded-lg bg-muted ring-1 ring-border">
          <img
            v-if="coverUrl"
            :src="coverUrl"
            :alt="coverAlt"
            crossorigin="anonymous"
            class="h-full w-full object-cover"
            @error="(e) => (e.target.style.display = 'none')"
          />
          <div
            v-else
            class="flex h-full w-full items-center justify-center text-[10px] font-black text-muted-foreground"
            aria-hidden="true"
          >
            {{ t('app.short') }}
          </div>
        </div>
      </div>

      <div
        class="flex min-h-0 flex-1 flex-col justify-between gap-2"
        :class="[
          !isSidebarExpanded
            ? 'md:opacity-0 md:pointer-events-none md:group-hover:opacity-100 md:group-hover:pointer-events-auto'
            : '',
        ]"
      >
        <div class="flex min-w-0 items-start gap-2.5 pt-0.5">
          <div
            class="relative shrink-0"
            :class="isSidebarExpanded ? 'h-11 w-11 md:h-12 md:w-12' : 'h-10 w-10 md:h-11 md:w-11'"
          >
            <div class="h-full w-full overflow-hidden rounded-lg bg-muted ring-1 ring-border">
              <img
                v-if="coverUrl"
                :src="coverUrl"
                :alt="coverAlt"
                crossorigin="anonymous"
                class="h-full w-full object-cover"
                @error="(e) => (e.target.style.display = 'none')"
              />
              <div
                v-else
                class="flex h-full w-full items-center justify-center text-[10px] font-black text-muted-foreground"
                aria-hidden="true"
              >
                {{ t('app.short') }}
              </div>
            </div>
            <div
              v-if="isPlaying"
              class="absolute bottom-0.5 right-0.5 flex h-4 w-4 items-end justify-center gap-[1px] rounded bg-black/60 p-0.5 backdrop-blur-md"
              aria-hidden="true"
            >
              <div class="w-[2px] rounded-full bg-white animate-eq-1" />
              <div class="w-[2px] rounded-full bg-white animate-eq-2" />
              <div class="w-[2px] rounded-full bg-white animate-eq-3" />
            </div>
          </div>

          <div class="min-w-0 flex-1 self-center">
            <p
              v-if="remoteBadge"
              class="mb-0.5 flex items-center gap-1 truncate text-[10px] font-semibold uppercase tracking-wide text-primary"
            >
              <Radio class="h-3 w-3 shrink-0" aria-hidden="true" />
              <span class="truncate">{{ remoteBadge }}</span>
            </p>
            <p
              class="truncate text-sm font-bold leading-tight md:text-[0.9rem]"
              :class="isPlaying ? 'text-primary' : 'text-foreground'"
            >
              {{ currentTrack?.title || t('player.waiting') }}
            </p>
            <p class="truncate text-xs font-medium text-muted-foreground">
              {{ displayArtist }}
            </p>
          </div>
        </div>

        <div
          class="flex items-center justify-center gap-0.5 pb-0.5"
          role="group"
          :aria-label="t('player.playControls')"
          data-mini-player-action
        >
          <button
            type="button"
            data-mini-player-action
            class="hidden h-8 w-8 items-center justify-center rounded-full hover:bg-muted md:flex"
            :aria-label="t('player.previous')"
            @click.stop="sync.remotePrev()"
          >
            <SkipBack class="h-4 w-4 fill-current" aria-hidden="true" />
          </button>

          <button
            type="button"
            data-mini-player-action
            class="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary transition-all hover:bg-primary hover:text-primary-foreground active:scale-95"
            :aria-label="isPlaying ? t('player.pause') : t('player.play')"
            @click.stop="sync.remoteTogglePlay()"
          >
            <component :is="isPlaying ? Pause : Play" class="h-[1.15rem] w-[1.15rem] fill-current" aria-hidden="true" />
          </button>

          <button
            type="button"
            data-mini-player-action
            class="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
            :aria-label="t('player.next')"
            @click.stop="sync.remoteNext()"
          >
            <SkipForward class="h-4 w-4 fill-current" aria-hidden="true" />
          </button>

          <button
            v-if="!isSidebarExpanded"
            type="button"
            data-mini-player-action
            class="ml-1 hidden h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-primary md:flex"
            :aria-label="t('player.fullscreen')"
            @click.stop="player.toggleExpand()"
          >
            <Maximize2 class="h-4 w-4" aria-hidden="true" />
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
    height: 3px;
  }
  50% {
    height: 8px;
  }
}
</style>
