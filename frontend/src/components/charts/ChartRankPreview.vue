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
const loading = ref(true)

const load = async () => {
  loading.value = true
  try {
    const data = await library.fetchStatsTop(props.range, props.limit, prefs.effectiveTimezone)
    tracks.value = Array.isArray(data?.tracks) ? data.tracks : []
  } catch {
    tracks.value = []
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
      <div>
        <h2 class="text-sm font-semibold">{{ title }}</h2>
        <p v-if="description" class="text-xs text-muted-foreground mt-0.5">{{ description }}</p>
      </div>
      <Button as-child variant="outline" size="sm">
        <RouterLink :to="detailTo">{{ t('charts.viewMore') }}</RouterLink>
      </Button>
    </div>

    <div v-if="loading" class="py-6 text-center text-sm text-muted-foreground">{{ t('charts.loading') }}</div>
    <p v-else-if="!tracks.length" class="py-6 text-center text-sm text-muted-foreground">{{ t('charts.noData') }}</p>
    <ul v-else class="flex flex-col gap-2">
      <li v-for="(track, idx) in tracks" :key="track.id">
        <ChartRankRow :rank="idx + 1" :track="track" compact @play="onPlay(idx)" />
      </li>
    </ul>
  </section>
</template>
