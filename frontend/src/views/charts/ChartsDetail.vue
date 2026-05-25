<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { usePreferencesStore } from '@/stores/preferences'
import { useRequiresAuth } from '@/composables/useRequiresAuth'
import ViewHeader from '@/components/shared/ViewHeader.vue'
import AuthEmptyState from '@/components/shared/AuthEmptyState.vue'
import ChartRankRow from '@/components/charts/ChartRankRow.vue'
import ChartPodium from '@/components/charts/ChartPodium.vue'
import ChartTotalsStrip from '@/components/charts/ChartTotalsStrip.vue'
import { Button } from '@/components/ui/button'

const { t } = useI18n()
const route = useRoute()
const library = useLibraryStore()
const player = usePlayerStore()
const prefs = usePreferencesStore()
const { showAuthEmpty } = useRequiresAuth()

const CHART_META = {
  weekly: { range: '7d', titleKey: 'charts.weekly.title', descKey: 'charts.weekly.description' },
  monthly: { range: '30d', titleKey: 'charts.monthly.title', descKey: 'charts.monthly.description' },
  alltime: { range: 'all', titleKey: 'charts.alltime.title', descKey: 'charts.alltime.description' },
}

const meta = computed(() => {
  const key = route.meta.chartPeriod ?? 'weekly'
  const m = CHART_META[key] ?? CHART_META.weekly
  return {
    range: m.range,
    title: t(m.titleKey),
    description: t(m.descKey),
  }
})

const tracks = ref([])
const totals = ref(null)
const loading = ref(true)
const error = ref(null)

const rest = computed(() => tracks.value.slice(3))

const load = async () => {
  if (showAuthEmpty.value) {
    tracks.value = []
    totals.value = null
    return
  }
  loading.value = true
  error.value = null
  try {
    const data = await library.fetchStatsTop(meta.value.range, 50, prefs.effectiveTimezone)
    tracks.value = Array.isArray(data?.tracks) ? data.tracks : []
    totals.value = data?.totals ?? null
  } catch (e) {
    console.error(e)
    error.value = e
    tracks.value = []
    totals.value = null
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch([meta, showAuthEmpty, () => prefs.effectiveTimezone], () => {
  void load()
})

function playAt(index) {
  if (!tracks.value.length) return
  void player.playList(tracks.value, index)
}
</script>

<template>
  <div class="w-full space-y-6">
    <div class="space-y-2 border-b pb-4">
      <Button as-child variant="ghost" size="sm" class="-ml-2 w-fit">
        <RouterLink to="/charts">{{ t('charts.backToList') }}</RouterLink>
      </Button>
      <ViewHeader :title="meta.title" :description="meta.description" :show-action="false" />
    </div>

    <AuthEmptyState v-if="showAuthEmpty" :description="t('charts.authEmpty')" />

    <template v-else>
      <div v-if="loading" class="py-16 flex flex-col items-center gap-3 text-muted-foreground">
        <div class="w-9 h-9 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p class="text-sm">{{ t('charts.loading') }}</p>
      </div>

      <div
        v-else-if="error"
        class="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
      >
        {{ t('charts.loadError') }}
      </div>

      <p v-else-if="!tracks.length" class="text-sm text-muted-foreground py-8 text-center">
        {{ t('charts.noPlaysYet') }}
      </p>

      <template v-else>
        <ChartTotalsStrip v-if="totals" :totals="totals" class="max-w-3xl" />

        <ChartPodium :tracks="tracks" class="max-w-3xl" @play="playAt" />

        <div v-if="rest.length" class="space-y-3 max-w-3xl">
          <h2 class="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
            {{ t('charts.restHeading', { from: 4, to: 3 + rest.length }) }}
          </h2>
          <ul class="flex flex-col gap-2">
            <li v-for="(track, idx) in rest" :key="track.id">
              <ChartRankRow :rank="idx + 4" :track="track" @play="playAt(idx + 3)" />
            </li>
          </ul>
        </div>
      </template>
    </template>
  </div>
</template>
