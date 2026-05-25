<script setup>
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { useLibraryStore } from '@/stores/library'
import { usePreferencesStore } from '@/stores/preferences'
import ChartRankRow from '@/components/charts/ChartRankRow.vue'
import { Button } from '@/components/ui/button'

const { t } = useI18n()

const props = defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  range: { type: String, required: true },
  detailTo: { type: String, required: true },
  limit: { type: Number, default: 5 },
})

const library = useLibraryStore()
const prefs = usePreferencesStore()
const tracks = ref([])
const totals = ref(null)
const loading = ref(true)
const errored = ref(false)

const load = async () => {
  loading.value = true
  errored.value = false
  try {
    const data = await library.fetchStatsTop(props.range, props.limit, prefs.effectiveTimezone)
    tracks.value = Array.isArray(data?.tracks) ? data.tracks : []
    totals.value = data?.totals ?? null
  } catch (err) {
    console.error('[charts] preview load failed', props.range, err)
    tracks.value = []
    totals.value = null
    errored.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => [props.range, prefs.effectiveTimezone], load)

const emit = defineEmits(['play-track'])

function onPlay(idx) {
  emit('play-track', { tracks: tracks.value, index: idx })
}
</script>

<template>
  <section class="space-y-3 rounded-2xl border border-border bg-card/40 p-4 md:p-5">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <h2 class="text-sm font-semibold">{{ title }}</h2>
          <span
            v-if="totals && totals.totalPlays > 0"
            class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary"
          >
            {{ t('charts.totalsBadge', { plays: totals.totalPlays, unique: totals.uniqueTrackCount }) }}
          </span>
        </div>
        <p v-if="description" class="text-xs text-muted-foreground">{{ description }}</p>
      </div>
      <Button as-child variant="outline" size="sm">
        <RouterLink :to="detailTo">{{ t('charts.viewMore') }}</RouterLink>
      </Button>
    </div>

    <div v-if="loading" class="py-6 text-center text-sm text-muted-foreground">{{ t('charts.loading') }}</div>
    <p
      v-else-if="errored"
      class="py-6 text-center text-sm text-destructive"
    >
      {{ t('charts.loadError') }}
    </p>
    <p v-else-if="!tracks.length" class="py-6 text-center text-sm text-muted-foreground">
      {{ t('charts.noPlaysYet') }}
    </p>
    <ul v-else class="flex flex-col gap-1.5">
      <li v-for="(track, idx) in tracks" :key="track.id">
        <ChartRankRow :rank="idx + 1" :track="track" compact @play="onPlay(idx)" />
      </li>
    </ul>
  </section>
</template>
