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
import TrackTagsPopover from '@/components/shared/TrackTagsPopover.vue'
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
  if (!tr?.id) return
  // 같은 별을 다시 탭하면 해제
  const nextRating = (currentTrack.value?.rating || 0) === rate ? 0 : rate
  await library.updateTrackRating(tr.id, nextRating)
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
        class="aspect-square w-full max-w-[min(100%,22rem)] max-h-full md:w-64 md:max-w-none lg:w-80 rounded-2xl md:rounded-3xl object-cover shadow-[0_20px_50px_rgba(0,0,0,0.35)] border border-white/10 ring-1 ring-black/5 transition-[transform,opacity] duration-700"
        :class="isPlaying ? '' : 'scale-[0.97] opacity-90'"
        alt=""
      />
      <div
        v-else
        class="aspect-square w-full max-w-[min(100%,22rem)] max-h-full md:w-64 md:max-w-none lg:w-80 rounded-2xl md:rounded-3xl bg-muted border border-white/10 flex items-center justify-center text-2xl md:text-3xl font-black text-muted-foreground/20 italic text-center px-6"
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
        <Button
          v-if="canEditTrackMeta"
          variant="ghost"
          size="icon"
          class="h-12 w-12 rounded-full shrink-0 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
          :aria-pressed="!!currentTrack?.starred"
          :aria-label="currentTrack?.starred ? t('player.favoriteRemove') : t('player.favoriteAdd')"
          @click="toggleFavorite()"
        >
          <Heart
            class="w-7 h-7"
            :class="currentTrack?.starred ? 'fill-red-500 text-red-500' : ''"
          />
        </Button>
      </div>

      <!-- 진행 바 -->
      <div class="space-y-2">
        <Slider v-model="progress" :max="100" :step="0.1" class="py-2" />
        <div class="flex justify-between text-xs font-mono font-bold text-muted-foreground tracking-tighter">
          <span>{{ formatTrackTime(currentTime) }}</span>
          <span>{{ formatTrackTime(duration) }}</span>
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
        <div
          v-if="canEditTrackMeta"
          class="flex items-center"
          role="group"
          :aria-label="t('player.trackRating')"
        >
          <button
            v-for="i in 5"
            :key="i"
            type="button"
            class="p-1.5 rounded-md transition-transform active:scale-110 hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            @click="changeRating(i)"
          >
            <Star
              class="w-6 h-6 md:w-7 md:h-7"
              :class="i <= (currentTrack?.rating || 0) ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground/35'"
            />
          </button>
        </div>
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
