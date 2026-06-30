<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import ViewHeader from '@/components/shared/ViewHeader.vue'
import PageLayout from '@/components/layout/PageLayout.vue'
import AuthEmptyState from '@/components/shared/AuthEmptyState.vue'
import ChartRankPreview from '@/components/charts/ChartRankPreview.vue'
import { useRequiresAuth } from '@/composables/useRequiresAuth'

const { t } = useI18n()
const { showAuthEmpty } = useRequiresAuth()
const player = usePlayerStore()

const sections = computed(() => [
  {
    key: 'weekly',
    shortTitle: t('charts.weekly.short'),
    description: t('charts.weekly.description'),
    range: '7d',
    detailTo: '/charts/weekly',
  },
  {
    key: 'monthly',
    shortTitle: t('charts.monthly.short'),
    description: t('charts.monthly.description'),
    range: '30d',
    detailTo: '/charts/monthly',
  },
  {
    key: 'alltime',
    shortTitle: t('charts.alltime.short'),
    description: t('charts.alltime.description'),
    range: 'all',
    detailTo: '/charts/alltime',
  },
])

function onPlay({ tracks, index }) {
  if (!tracks?.length) return
  void player.playList(tracks, index)
}
</script>

<template>
  <PageLayout spacing="8">
    <ViewHeader
      :title="t('charts.title')"
      :description="t('charts.description')"
      :show-action="false"
    />

    <AuthEmptyState v-if="showAuthEmpty" :description="t('charts.authEmpty')" />

    <template v-else>
      <ChartRankPreview
        v-for="section in sections"
        :key="section.key"
        :title="section.shortTitle"
        :description="section.description"
        :range="section.range"
        :detail-to="section.detailTo"
        :limit="5"
        @play-track="onPlay"
      />
    </template>
  </PageLayout>
</template>
