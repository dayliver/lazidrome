<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import SafeImage from '@/components/shared/SafeImage.vue'
import { Crown, Medal, Award } from 'lucide-vue-next'

const props = defineProps({
  artists: { type: Array, default: () => [] },
})

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()

const top3 = computed(() => props.artists.slice(0, 3))
const first = computed(() => top3.value[0] ?? null)
const second = computed(() => top3.value[1] ?? null)
const third = computed(() => top3.value[2] ?? null)

function goTo(artist) {
  if (!artist?.id) return
  void router.push({ name: 'artist-detail', params: { id: artist.id } })
}
</script>

<template>
  <div v-if="first" class="grid grid-cols-3 gap-2 sm:gap-4 items-end">
    <button
      v-if="second"
      type="button"
      class="group flex flex-col items-center justify-end gap-2 rounded-2xl border border-border bg-card/60 px-3 pt-4 pb-3 transition-all hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring h-48 sm:h-56"
      @click="goTo(second)"
    >
      <Medal class="w-5 h-5 text-zinc-400" />
      <SafeImage
        :src="auth.coverSrc('artist', second.id)"
        type="artist"
        :alt="t('common.coverAlt', { name: second.name })"
        class="w-16 h-16 sm:w-20 sm:h-20 rounded-full ring-1 ring-border object-cover"
      />
      <div class="text-center min-w-0 w-full">
        <p class="truncate text-sm font-semibold">{{ second.name }}</p>
        <p class="truncate text-[11px] text-muted-foreground min-h-[1rem]">&nbsp;</p>
        <p class="text-[10px] text-muted-foreground tabular-nums mt-1">
          {{ t('chartsRow.playsShort', { count: second.period_plays ?? 0 }) }}
        </p>
      </div>
    </button>
    <div v-else aria-hidden="true" class="h-48 sm:h-56" />

    <button
      type="button"
      class="group flex flex-col items-center justify-end gap-2 rounded-2xl border-2 border-primary/40 bg-primary/5 px-3 pt-4 pb-3 transition-all hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring h-56 sm:h-64 shadow-[0_0_20px_rgba(var(--primary),0.08)]"
      @click="goTo(first)"
    >
      <Crown class="w-6 h-6 text-amber-500" />
      <SafeImage
        :src="auth.coverSrc('artist', first.id)"
        type="artist"
        :alt="t('common.coverAlt', { name: first.name })"
        class="w-20 h-20 sm:w-24 sm:h-24 rounded-full ring-2 ring-primary/30 object-cover"
      />
      <div class="text-center min-w-0 w-full">
        <p class="truncate text-sm font-bold">{{ first.name }}</p>
        <p class="truncate text-xs text-muted-foreground min-h-[1rem]">&nbsp;</p>
        <p class="text-[11px] text-primary tabular-nums mt-1 font-semibold">
          {{ t('chartsRow.playsShort', { count: first.period_plays ?? 0 }) }}
        </p>
      </div>
    </button>

    <button
      v-if="third"
      type="button"
      class="group flex flex-col items-center justify-end gap-2 rounded-2xl border border-border bg-card/60 px-3 pt-4 pb-3 transition-all hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring h-44 sm:h-52"
      @click="goTo(third)"
    >
      <Award class="w-5 h-5 text-amber-700" />
      <SafeImage
        :src="auth.coverSrc('artist', third.id)"
        type="artist"
        :alt="t('common.coverAlt', { name: third.name })"
        class="w-14 h-14 sm:w-16 sm:h-16 rounded-full ring-1 ring-border object-cover"
      />
      <div class="text-center min-w-0 w-full">
        <p class="truncate text-sm font-semibold">{{ third.name }}</p>
        <p class="truncate text-[11px] text-muted-foreground min-h-[1rem]">&nbsp;</p>
        <p class="text-[10px] text-muted-foreground tabular-nums mt-1">
          {{ t('chartsRow.playsShort', { count: third.period_plays ?? 0 }) }}
        </p>
      </div>
    </button>
    <div v-else aria-hidden="true" class="h-44 sm:h-52" />
  </div>
</template>
