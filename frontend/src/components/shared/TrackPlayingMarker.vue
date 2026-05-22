<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  /** 0 기반 행 번호 (# 열 표시용) */
  listIndex: { type: Number, required: true },
  /** 해당 행 트랙 id */
  trackId: { type: [String, Number], required: true },
  nowPlayingTrackId: { type: String, default: null },
  playerIsPlaying: { type: Boolean, default: false },
  togglePlay: { type: Function, required: true },
})

const active = computed(
  () => props.nowPlayingTrackId != null && String(props.trackId) === String(props.nowPlayingTrackId)
)
const showPauseButton = computed(() => active.value && props.playerIsPlaying)
const showPlayButton = computed(() => active.value && !props.playerIsPlaying)
const { t } = useI18n()
</script>

<template>
  <div class="flex h-5 w-8 items-center justify-center font-mono text-xs text-muted-foreground">
    <template v-if="showPauseButton">
      <button
        type="button"
        class="playing-toggle"
        :title="t('player.pause')"
        @click.stop="togglePlay()"
      >||</button>
    </template>
    <template v-else-if="showPlayButton">
      <button
        type="button"
        class="playing-toggle"
        :title="t('player.play')"
        @click.stop="togglePlay()"
      >▶</button>
    </template>
    <template v-else>
      <span class="group-hover:hidden">{{ listIndex + 1 }}</span>
      <span class="hidden text-primary group-hover:block">▶</span>
    </template>
  </div>
</template>

<style scoped>
.playing-toggle {
  min-width: 1.2rem;
  line-height: 1;
  color: oklch(var(--primary));
  font-weight: 800;
  letter-spacing: -0.06em;
}
</style>
