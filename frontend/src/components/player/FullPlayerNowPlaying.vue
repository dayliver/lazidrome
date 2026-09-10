<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, Repeat2, ListMusic, Radio, MonitorSpeaker, Minus, Plus } from 'lucide-vue-next'
import { PLAYBACK_RATE_MIN, PLAYBACK_RATE_MAX, isValidLoopRegion } from '@/lib/playbackAdjust.js'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { splitTrailingParentheticals } from '@/lib/titleParts'
import { usePlayerPresentation } from '@/composables/usePlayerPresentation.js'
import { formatTrackTime } from '@/lib/audio'
import ConnectedDevicesTrigger from '@/components/player/ConnectedDevicesTrigger.vue'
import TrackTagsPopover from '@/components/shared/TrackTagsPopover.vue'
import FavoriteButton from '@/components/shared/FavoriteButton.vue'
import StarRating from '@/components/shared/StarRating.vue'
import { useAuthStore } from '@/stores/auth'

const {
  player,
  isRemote,
  currentTrack,
  coverUrl,
  isPlaying,
  currentTime,
  duration,
  isShuffle,
  repeatMode,
  canEditTrackMeta,
  canControlPlayback,
  remoteBadge,
  progress,
  togglePlay,
  next,
  prev,
  toggleShuffle,
  toggleRepeat,
  setLoopStartAtCurrent,
  setLoopEndAtCurrent,
  toggleLoopRegion,
  nudgePlaybackRate,
  toggleQueueView,
  transferPlaybackHere,
  library,
} = usePlayerPresentation()

const { t } = useI18n()
const auth = useAuthStore()

const trackTitleParts = computed(() => splitTrailingParentheticals(currentTrack.value?.title))

const loopRegionActive = computed(() =>
  player.loopRegionEnabled && isValidLoopRegion(player.loopStartSec, player.loopEndSec),
)

const loopHighlightStyle = computed(() => {
  const d = duration.value
  if (!loopRegionActive.value || !d || d <= 0) return null
  const left = (player.loopStartSec / d) * 100
  const width = ((player.loopEndSec - player.loopStartSec) / d) * 100
  return {
    left: `${Math.max(0, left)}%`,
    width: `${Math.min(100 - Math.max(0, left), Math.max(0, width))}%`,
  }
})

const canSlowDown = computed(() => player.playbackRate > PLAYBACK_RATE_MIN + 0.001)
const canSpeedUp = computed(() => player.playbackRate < PLAYBACK_RATE_MAX - 0.001)
const playbackRateLabel = computed(() => `${player.playbackRate.toFixed(1)}×`)

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
  <div class="flex h-full w-full min-h-0 flex-col md:flex-row md:items-center md:justify-center gap-4 md:gap-10 lg:gap-14">
    <!-- 커버: 모바일에서는 남는 높이에 맞춰 축소 (잘림 방지) -->
    <div class="flex-1 md:flex-none min-h-[6rem] md:min-h-0 min-w-0 flex items-center justify-center">
      <img
        v-if="coverUrl"
        :src="coverUrl"
        crossorigin="anonymous"
        class="aspect-square w-full max-w-[min(100%,22rem)] max-h-full md:w-64 md:max-w-none lg:w-80 rounded-2xl md:rounded-3xl object-cover shadow-[0_20px_50px_rgba(0,0,0,0.35)] border border-border/60 ring-1 ring-black/5 transition-[transform,opacity] duration-700"
        :class="isPlaying ? '' : 'scale-[0.97] opacity-90'"
        alt=""
      />
      <div
        v-else
        class="aspect-square w-full max-w-[min(100%,22rem)] max-h-full md:w-64 md:max-w-none lg:w-80 rounded-2xl md:rounded-3xl bg-muted border border-border/60 flex items-center justify-center text-2xl md:text-3xl font-black text-muted-foreground/20 italic text-center px-6"
      >
        {{ t('app.name') }}
      </div>
    </div>

    <!-- 정보 + 컨트롤 -->
    <div class="w-full shrink-0 md:shrink md:flex-1 md:min-w-0 flex flex-col gap-4 md:gap-7 max-w-xl md:max-w-2xl mx-auto md:mx-0">
      <div
        v-if="isRemote || auth.isAuthenticated"
        class="flex flex-wrap items-center justify-center md:justify-start gap-2"
      >
        <template v-if="isRemote">
          <span class="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-primary">
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

      <!-- 제목·아티스트 + 하트 (업계 표준: 타이틀 행 우측) -->
      <div class="flex items-center gap-3">
        <div class="flex-1 min-w-0 space-y-1 text-left">
          <h2 class="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight leading-tight line-clamp-2">
            <template v-if="currentTrack?.title">
              {{ trackTitleParts.main }}
              <span
                v-if="trackTitleParts.suffix"
                class="ms-2 md:ms-3 font-medium text-base md:text-xl lg:text-2xl text-muted-foreground/95"
              >{{ trackTitleParts.suffix }}</span>
            </template>
            <template v-else>{{ t('player.selectTrack') }}</template>
          </h2>
          <p class="text-base md:text-lg lg:text-xl text-muted-foreground font-medium opacity-80 truncate">
            {{ currentTrack?.artist || t('player.noArtist') }}
          </p>
        </div>
        <FavoriteButton
          v-if="canEditTrackMeta"
          :starred="!!currentTrack?.starred"
          size="lg"
          @toggle="toggleFavorite()"
        />
      </div>

      <!-- 진행 바 -->
      <div class="space-y-2">
        <div class="relative player-progress">
          <div
            v-if="loopHighlightStyle"
            class="pointer-events-none absolute inset-x-0 top-1/2 z-0 h-2 -translate-y-1/2 rounded-full bg-primary/30"
            :style="loopHighlightStyle"
          />
          <Slider v-model="progress" :max="100" :step="0.1" class="relative z-10 py-2" />
        </div>
        <div class="flex justify-between text-xs font-mono font-bold text-muted-foreground tracking-tighter">
          <span>{{ formatTrackTime(currentTime) }}</span>
          <span>{{ formatTrackTime(duration) }}</span>
        </div>
      </div>

      <!-- 구간 반복 · 재생 속도 (로컬 재생만) -->
      <div
        v-if="canControlPlayback"
        class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/30 px-3 py-2.5"
      >
        <div class="flex items-center gap-1.5">
          <span class="sr-only">{{ t('player.loopToggle') }}</span>
          <Button
            variant="outline"
            size="sm"
            class="h-8 min-w-8 px-2 font-mono font-bold"
            :class="player.loopStartSec > 0 ? 'border-primary/50 text-primary' : ''"
            :aria-label="t('player.loopStart')"
            @click="setLoopStartAtCurrent()"
          >
            A
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="h-8 min-w-8 px-2 font-mono font-bold"
            :class="player.loopEndSec > player.loopStartSec ? 'border-primary/50 text-primary' : ''"
            :aria-label="t('player.loopEnd')"
            @click="setLoopEndAtCurrent()"
          >
            B
          </Button>
          <Button
            variant="ghost"
            size="icon"
            class="h-8 w-8"
            :class="loopRegionActive ? 'text-primary bg-primary/10' : 'text-muted-foreground/70'"
            :aria-label="loopRegionActive ? t('player.loopClear') : t('player.loopToggle')"
            @click="toggleLoopRegion()"
          >
            <Repeat2 class="w-4 h-4" />
          </Button>
        </div>

        <div class="flex items-center gap-1.5">
          <span class="sr-only">{{ t('player.playbackSpeed') }}</span>
          <Button
            variant="outline"
            size="icon"
            class="h-8 w-8"
            :disabled="!canSlowDown"
            :aria-label="t('player.speedDown')"
            @click="nudgePlaybackRate(-0.1)"
          >
            <Minus class="w-4 h-4" />
          </Button>
          <span class="min-w-[3.25rem] text-center text-xs font-mono font-bold tabular-nums">
            {{ playbackRateLabel }}
          </span>
          <Button
            variant="outline"
            size="icon"
            class="h-8 w-8"
            :disabled="!canSpeedUp"
            :aria-label="t('player.speedUp')"
            @click="nudgePlaybackRate(0.1)"
          >
            <Plus class="w-4 h-4" />
          </Button>
        </div>
      </div>

      <!-- 재생 컨트롤 -->
      <div class="flex items-center justify-between">
        <Button variant="ghost" size="icon" class="h-12 w-12" @click="toggleShuffle()" :class="isShuffle ? 'text-primary bg-primary/10' : 'text-muted-foreground/60'">
          <Shuffle class="w-6 h-6" />
        </Button>

        <div class="flex items-center gap-3 md:gap-6">
          <Button variant="ghost" size="icon" class="h-14 w-14 rounded-full" @click="prev()">
            <SkipBack class="w-8 h-8 fill-current" />
          </Button>
          <Button variant="default" size="icon" class="h-18 w-18 md:h-20 md:w-20 rounded-full shadow-2xl bg-primary" @click="togglePlay()">
            <component :is="isPlaying ? Pause : Play" class="w-9 h-9 md:w-10 md:h-10 fill-current" />
          </Button>
          <Button variant="ghost" size="icon" class="h-14 w-14 rounded-full" @click="next()">
            <SkipForward class="w-8 h-8 fill-current" />
          </Button>
        </div>

        <Button variant="ghost" size="icon" class="h-12 w-12" @click="toggleRepeat()" :class="repeatMode !== 'off' ? 'text-primary bg-primary/10' : 'text-muted-foreground/60'">
          <Repeat1 v-if="repeatMode === 'one'" class="w-6 h-6" />
          <Repeat v-else class="w-6 h-6" />
        </Button>
      </div>

      <!-- 하단 액션 바: 별점 · 태그 · 큐 -->
      <div class="flex items-center justify-between gap-2 border-t border-border/50 pt-3 md:pt-5">
        <StarRating
          v-if="canEditTrackMeta"
          :rating="currentTrack?.rating || 0"
          interactive
          size="lg"
          @change="changeRating"
        />
        <div v-else />

        <div class="flex items-center gap-1">
          <TrackTagsPopover v-if="canEditTrackMeta" :track="currentTrack" size="icon" />
          <Button
            variant="ghost"
            size="icon"
            class="h-12 w-12 rounded-full"
            :aria-label="t('player.upNext')"
            @click="toggleQueueView()"
          >
            <ListMusic class="w-6 h-6" />
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
