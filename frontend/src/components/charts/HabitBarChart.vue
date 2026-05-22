<script setup>
import { computed } from 'vue'
import { formatListenSeconds } from '@/lib/listenTime'

const props = defineProps({
  data: { type: Array, default: () => [] },
  /** 'day' | 'time' — 시간대는 가로 스크롤 */
  variant: { type: String, default: 'day' },
  maxHeight: { type: Number, default: 200 },
})

const maxSec = computed(() =>
  Math.max(1, ...props.data.map((d) => Number(d.listenSec) || 0))
)

function barHeight(sec) {
  const s = Number(sec) || 0
  if (s <= 0) return 4
  return Math.max(8, Math.round((s / maxSec.value) * props.maxHeight))
}
</script>

<template>
  <div
    :class="[
      'flex items-end gap-2 w-full',
      variant === 'time' ? 'overflow-x-auto pb-1 min-h-[220px]' : 'min-h-[220px]',
    ]"
  >
    <div
      v-for="(item, i) in data"
      :key="item.key ?? item.dow ?? item.label ?? i"
      :class="[
        'flex flex-col items-center justify-end gap-1 shrink-0',
        variant === 'time' ? 'w-[3.25rem]' : 'flex-1 min-w-0',
      ]"
    >
      <span class="text-[10px] font-semibold tabular-nums text-foreground leading-tight text-center whitespace-nowrap">
        {{ formatListenSeconds(item.listenSec) }}
      </span>
      <div
        class="w-full rounded-t-md bg-primary/90 transition-all"
        :style="{ height: `${barHeight(item.listenSec)}px` }"
        :title="`${item.label}: ${formatListenSeconds(item.listenSec)}`"
      />
      <span
        class="text-[10px] text-muted-foreground text-center leading-tight"
        :class="variant === 'time' ? 'whitespace-nowrap' : ''"
      >
        {{ item.label }}
      </span>
    </div>
  </div>
</template>
