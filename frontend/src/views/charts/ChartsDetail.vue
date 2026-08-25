<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { usePreferencesStore } from '@/stores/preferences'
import { useRequiresAuth } from '@/composables/useRequiresAuth'
import ViewHeader from '@/components/shared/ViewHeader.vue'
import PageLayout from '@/components/layout/PageLayout.vue'
import DeviceScopeSelect from '@/components/shared/DeviceScopeSelect.vue'
import AuthEmptyState from '@/components/shared/AuthEmptyState.vue'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
import ChartRankRow from '@/components/charts/ChartRankRow.vue'
import ChartArtistRankRow from '@/components/charts/ChartArtistRankRow.vue'
import ChartPodium from '@/components/charts/ChartPodium.vue'
import ChartArtistPodium from '@/components/charts/ChartArtistPodium.vue'
import ChartTotalsStrip from '@/components/charts/ChartTotalsStrip.vue'
import ChartDualPanel from '@/components/charts/ChartDualPanel.vue'
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
const artists = ref([])
const totals = ref(null)
const loading = ref(true)
const error = ref(null)

const restTracks = computed(() => tracks.value.slice(3))
const restArtists = computed(() => artists.value.slice(3))

const hasAnyData = computed(() => tracks.value.length > 0 || artists.value.length > 0)

const load = async () => {
  if (showAuthEmpty.value) {
    tracks.value = []
    artists.value = []
    totals.value = null
    return
  }
  loading.value = true
  error.value = null
  try {
    const data = await library.fetchStatsTop(
      meta.value.range,
      50,
      prefs.effectiveTimezone,
      prefs.statsDeviceScope,
    )
    tracks.value = Array.isArray(data?.tracks) ? data.tracks : []
    artists.value = Array.isArray(data?.artists) ? data.artists : []
    totals.value = data?.totals ?? null
  } catch (e) {
    console.error(e)
    error.value = e
    tracks.value = []
    artists.value = []
    totals.value = null
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch([meta, showAuthEmpty, () => prefs.effectiveTimezone, () => prefs.statsDeviceScope], () => {
  void load()
})

function playTrackAt(index) {
  if (!tracks.value.length) return
  void player.playList(tracks.value, index)
}
</script>

<template>
  <PageLayout>
    <div class="space-y-2 border-b pb-4">
      <Button as-child variant="ghost" size="sm" class="-ml-2 w-fit">
        <RouterLink to="/charts">{{ t('charts.backToList') }}</RouterLink>
      </Button>
      <ViewHeader :title="meta.title" :description="meta.description" :show-action="false" />
    </div>

    <AuthEmptyState v-if="showAuthEmpty" :description="t('charts.authEmpty')" />

    <template v-else>
      <DeviceScopeSelect />

      <LoadingSpinner v-if="loading" size="lg" :label="t('charts.loading')" />

      <div
        v-else-if="error"
        class="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
      >
        {{ t('charts.loadError') }}
      </div>

      <p v-else-if="!hasAnyData" class="text-sm text-muted-foreground py-8 text-center">
        {{ t('charts.noPlaysYet') }}
      </p>

      <template v-else>
        <ChartTotalsStrip v-if="totals" :totals="totals" class="mt-2" />

        <p class="text-xs text-muted-foreground mt-4 md:mt-6">{{ t('charts.artistsHint') }}</p>

        <ChartDualPanel class="mt-3">
          <template #tracks>
            <template v-if="tracks.length">
              <ChartPodium :tracks="tracks" @play="playTrackAt" />

              <div v-if="restTracks.length" class="space-y-3">
                <h2 class="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                  {{ t('charts.restHeading', { from: 4, to: 3 + restTracks.length }) }}
                </h2>
                <ul class="flex flex-col gap-2">
                  <li v-for="(track, idx) in restTracks" :key="track.id">
                    <ChartRankRow :rank="idx + 4" :track="track" @play="playTrackAt(idx + 3)" />
                  </li>
                </ul>
              </div>
            </template>
            <p v-else class="text-sm text-muted-foreground py-6 text-center">
              {{ t('charts.noPlaysYet') }}
            </p>
          </template>

          <template #artists>
            <template v-if="artists.length">
              <ChartArtistPodium :artists="artists" />

              <div v-if="restArtists.length" class="space-y-3">
                <h2 class="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                  {{ t('charts.restHeading', { from: 4, to: 3 + restArtists.length }) }}
                </h2>
                <ul class="flex flex-col gap-2">
                  <li v-for="(artist, idx) in restArtists" :key="artist.id">
                    <ChartArtistRankRow :rank="idx + 4" :artist="artist" />
                  </li>
                </ul>
              </div>
            </template>
            <p v-else class="text-sm text-muted-foreground py-6 text-center">
              {{ t('charts.noPlaysYet') }}
            </p>
          </template>
        </ChartDualPanel>
      </template>
    </template>
  </PageLayout>
</template>
