<script setup>
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import SafeImage from '@/components/shared/SafeImage.vue'

defineProps({
  rank: { type: Number, required: true },
  track: { type: Object, required: true },
  compact: { type: Boolean, default: false },
})

const emit = defineEmits(['play'])

const auth = useAuthStore()
const { t } = useI18n()
</script>

<template>
  <button
    type="button"
    class="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-border bg-card/60 px-3 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    @click="emit('play')"
  >
    <span
      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-bold tabular-nums text-muted-foreground"
    >
      {{ rank }}
    </span>
    <SafeImage
      :src="auth.coverSrc('track', track.id)"
      type="track"
      :alt="t('common.coverAlt', { name: track.title })"
      class="h-10 w-10 shrink-0 rounded-md ring-1 ring-border"
    />
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-medium">{{ track.title }}</p>
      <p class="truncate text-xs text-muted-foreground">{{ track.artist || '—' }}</p>
      <p v-if="!compact" class="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
        {{ t('chartsRow.periodPlays', { count: track.period_plays ?? '—' }) }}
        <span v-if="track.rating"> · ★{{ track.rating }}</span>
        <span v-if="track.all_time_plays != null">{{ t('chartsRow.allTimePlays', { count: track.all_time_plays }) }}</span>
      </p>
      <p v-else class="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
        {{ t('chartsRow.playsShort', { count: track.period_plays ?? 0 }) }}
        <span v-if="track.rating"> · ★{{ track.rating }}</span>
      </p>
    </div>
  </button>
</template>
