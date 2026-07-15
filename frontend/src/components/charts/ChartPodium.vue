<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import SafeImage from '@/components/shared/SafeImage.vue'
import { formatChartListenWithPlays } from '@/lib/listenTime'
import { splitTrailingParentheticals } from '@/lib/titleParts'
import { Crown, Medal, Award } from 'lucide-vue-next'

/**
 * 차트 상위 3곡 시상대.
 * 1위 가운데, 2위 왼쪽, 3위 오른쪽으로 배치한다.
 * 데이터가 3개 미만이면 가운데(있는 위치)만 채운다.
 */
const props = defineProps({
  tracks: { type: Array, default: () => [] },
})

const emit = defineEmits(['play'])

const { t } = useI18n()
const auth = useAuthStore()

const top3 = computed(() => props.tracks.slice(0, 3))
const first = computed(() => top3.value[0] ?? null)
const second = computed(() => top3.value[1] ?? null)
const third = computed(() => top3.value[2] ?? null)

const firstTitle = computed(() => splitTrailingParentheticals(first.value?.title))
const secondTitle = computed(() => splitTrailingParentheticals(second.value?.title))
const thirdTitle = computed(() => splitTrailingParentheticals(third.value?.title))

function trigger(rank) {
  emit('play', rank - 1)
}
</script>

<template>
  <div v-if="first" class="grid grid-cols-3 gap-2 sm:gap-4 items-end">
    <button
      v-if="second"
      type="button"
      class="group flex flex-col items-center justify-end gap-2 rounded-2xl border border-border bg-card/60 px-3 pt-4 pb-3 transition-all hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring h-48 sm:h-56"
      @click="trigger(2)"
    >
      <Medal class="w-5 h-5 text-zinc-400" />
      <SafeImage
        :src="auth.coverSrc('track', second.id)"
        type="track"
        :alt="t('common.coverAlt', { name: second.title })"
        class="w-16 h-16 sm:w-20 sm:h-20 rounded-xl ring-1 ring-border object-cover"
      />
      <div class="text-center min-w-0 w-full">
        <p class="truncate text-sm font-semibold">
          <template v-if="secondTitle.suffix">
            {{ secondTitle.main }}<span class="ms-1 text-xs font-medium text-muted-foreground/90">{{ secondTitle.suffix }}</span>
          </template>
          <template v-else>{{ second.title }}</template>
        </p>
        <p class="truncate text-[11px] text-muted-foreground min-h-[1rem]">{{ second.artist || '—' }}</p>
        <p class="text-[10px] text-muted-foreground tabular-nums mt-1">
          {{ formatChartListenWithPlays(second.period_listen_sec ?? 0, second.period_plays ?? 0) }}
        </p>
      </div>
    </button>
    <div v-else aria-hidden="true" class="h-48 sm:h-56" />

    <button
      type="button"
      class="group flex flex-col items-center justify-end gap-2 rounded-2xl border-2 border-primary/40 bg-primary/5 px-3 pt-4 pb-3 transition-all hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring h-56 sm:h-64 shadow-[0_0_20px_rgba(var(--primary),0.08)]"
      @click="trigger(1)"
    >
      <Crown class="w-6 h-6 text-amber-500" />
      <SafeImage
        :src="auth.coverSrc('track', first.id)"
        type="track"
        :alt="t('common.coverAlt', { name: first.title })"
        class="w-20 h-20 sm:w-24 sm:h-24 rounded-xl ring-2 ring-primary/30 object-cover"
      />
      <div class="text-center min-w-0 w-full">
        <p class="truncate text-sm font-bold">
          <template v-if="firstTitle.suffix">
            {{ firstTitle.main }}<span class="ms-1 text-xs font-medium text-muted-foreground/90">{{ firstTitle.suffix }}</span>
          </template>
          <template v-else>{{ first.title }}</template>
        </p>
        <p class="truncate text-xs text-muted-foreground min-h-[1rem]">{{ first.artist || '—' }}</p>
        <p class="text-[11px] text-primary tabular-nums mt-1 font-semibold">
          {{ formatChartListenWithPlays(first.period_listen_sec ?? 0, first.period_plays ?? 0) }}
          <span v-if="first.rating"> · ★{{ first.rating }}</span>
        </p>
      </div>
    </button>

    <button
      v-if="third"
      type="button"
      class="group flex flex-col items-center justify-end gap-2 rounded-2xl border border-border bg-card/60 px-3 pt-4 pb-3 transition-all hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring h-44 sm:h-52"
      @click="trigger(3)"
    >
      <Award class="w-5 h-5 text-amber-700" />
      <SafeImage
        :src="auth.coverSrc('track', third.id)"
        type="track"
        :alt="t('common.coverAlt', { name: third.title })"
        class="w-14 h-14 sm:w-16 sm:h-16 rounded-xl ring-1 ring-border object-cover"
      />
      <div class="text-center min-w-0 w-full">
        <p class="truncate text-sm font-semibold">
          <template v-if="thirdTitle.suffix">
            {{ thirdTitle.main }}<span class="ms-1 text-xs font-medium text-muted-foreground/90">{{ thirdTitle.suffix }}</span>
          </template>
          <template v-else>{{ third.title }}</template>
        </p>
        <p class="truncate text-[11px] text-muted-foreground min-h-[1rem]">{{ third.artist || '—' }}</p>
        <p class="text-[10px] text-muted-foreground tabular-nums mt-1">
          {{ formatChartListenWithPlays(third.period_listen_sec ?? 0, third.period_plays ?? 0) }}
        </p>
      </div>
    </button>
    <div v-else aria-hidden="true" class="h-44 sm:h-52" />
  </div>
</template>
