<script setup>
import { useI18n } from 'vue-i18n'
import SafeImage from '@/components/shared/SafeImage.vue'

defineProps({
  rank: { type: Number, required: true },
  coverSrc: { type: String, default: '' },
  coverType: { type: String, default: 'track' },
  /** track: rounded-md, artist: rounded-full */
  coverVariant: { type: String, default: 'track' },
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  periodPlays: { type: Number, default: 0 },
  allTimePlays: { type: Number, default: null },
  rating: { type: Number, default: 0 },
  compact: { type: Boolean, default: false },
})

const emit = defineEmits(['click'])

const { t } = useI18n()

const coverClass =
  'h-10 w-10 shrink-0 ring-1 ring-border object-cover'
</script>

<template>
  <button
    type="button"
    class="flex w-full min-h-[4.5rem] cursor-pointer items-center gap-3 rounded-xl border border-border bg-card/60 px-3 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    @click="emit('click')"
  >
    <span
      class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-bold tabular-nums text-muted-foreground"
    >
      {{ rank }}
    </span>
    <SafeImage
      :src="coverSrc"
      :type="coverType"
      :alt="t('common.coverAlt', { name: title })"
      :class="[
        coverClass,
        coverVariant === 'artist' ? 'rounded-full' : 'rounded-md',
      ]"
    />
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-medium leading-snug">{{ title }}</p>
      <p class="truncate text-xs text-muted-foreground leading-snug mt-0.5 min-h-[1rem]">
        {{ subtitle || '\u00a0' }}
      </p>
      <p v-if="!compact" class="text-[10px] text-muted-foreground mt-0.5 tabular-nums leading-snug">
        {{ t('chartsRow.periodPlays', { count: periodPlays ?? '—' }) }}
        <span v-if="rating"> · ★{{ rating }}</span>
        <span v-if="allTimePlays != null">{{ t('chartsRow.allTimePlays', { count: allTimePlays }) }}</span>
      </p>
      <p v-else class="text-[10px] text-muted-foreground mt-0.5 tabular-nums leading-snug">
        {{ t('chartsRow.playsShort', { count: periodPlays ?? 0 }) }}
        <span v-if="rating"> · ★{{ rating }}</span>
      </p>
    </div>
  </button>
</template>
