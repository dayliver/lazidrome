<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatListenSeconds } from '@/lib/listenTime'

/**
 * 차트 헤더에 보여줄 기간 합계 (총 재생, 청취 시간, 고유 트랙).
 * totals가 없으면 0으로 표시(스켈레톤 대신 0이 자연스러움).
 */
const props = defineProps({
  totals: {
    type: Object,
    default: () => ({ totalPlays: 0, totalListenSec: 0, uniqueTrackCount: 0 }),
  },
})

const { t } = useI18n()

const cells = computed(() => {
  const items = [
    {
      key: 'plays',
      label: t('charts.totals.plays'),
      value: (props.totals?.totalPlays ?? 0).toLocaleString(),
    },
    {
      key: 'listen',
      label: t('charts.totals.listen'),
      value: formatListenSeconds(props.totals?.totalListenSec ?? 0),
    },
    {
      key: 'unique',
      label: t('charts.totals.unique'),
      value: (props.totals?.uniqueTrackCount ?? 0).toLocaleString(),
    },
  ]
  if (props.totals?.uniqueArtistCount != null) {
    items.push({
      key: 'artists',
      label: t('charts.totals.uniqueArtists'),
      value: (props.totals.uniqueArtistCount ?? 0).toLocaleString(),
    })
  }
  return items
})
</script>

<template>
  <div
    class="grid gap-2 sm:gap-4 rounded-2xl border bg-card/60 p-3 sm:p-4"
    :class="cells.length > 3 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'"
  >
    <div
      v-for="cell in cells"
      :key="cell.key"
      class="flex flex-col items-center justify-center text-center"
    >
      <p class="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground font-semibold">
        {{ cell.label }}
      </p>
      <p class="mt-1 text-lg sm:text-2xl font-black tabular-nums leading-tight">
        {{ cell.value }}
      </p>
    </div>
  </div>
</template>
