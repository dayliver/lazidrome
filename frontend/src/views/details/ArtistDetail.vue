<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useSyncTrackListWithLibrary } from '@/composables/useSyncTrackListWithLibrary'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useCoverUrl } from '@/composables/useCoverUrl'
import { useLibraryStore } from '@/stores/library'
import { useMetadataEditStore } from '@/stores/metadataEdit'

import { Users, Edit } from 'lucide-vue-next'

import { VisXYContainer, VisStackedBar, VisAxis } from '@unovis/vue'
import { ChartContainer, ChartTooltip } from '@/components/ui/chart'
import DetailLayout from '@/components/layout/DetailLayout.vue'
import { Button } from '@/components/ui/button'

import TrackListTable from '@/components/shared/TrackListTable.vue'
import AlbumGrid from '@/components/shared/AlbumGrid.vue'
import SectionHeader from '@/components/shared/SectionHeader.vue'
const { t } = useI18n()

const route = useRoute()
const library = useLibraryStore()
const metadataEdit = useMetadataEditStore()

const { data: artist, isLoading } = useAsyncResource(
  () => route.params.id,
  async (id) => library.getArtistById(id)
)

useSyncTrackListWithLibrary(() => artist.value?.tracks)

const imageUrl = useCoverUrl('artist', () => artist.value?.id)

const artistStats = computed(() => {
  if (!artist.value?.tracks) return []

  const tracks = artist.value.tracks
  const ratedTracks = tracks.filter((t) => t.rating > 0)
  const avgRating =
    ratedTracks.length > 0
      ? (ratedTracks.reduce((acc, t) => acc + t.rating, 0) / ratedTracks.length).toFixed(1)
      : '0.0'

  return [
    { label: t('pages.details.artistStatTotalTracks'), value: tracks.length },
    { label: t('pages.details.artistStatAvgRating'), value: avgRating }
  ]
})

const artistAlbums = computed(() => {
  if (!artist.value?.tracks) return []
  const albumMap = new Map()

  artist.value.tracks.forEach((t) => {
    if (t.albumId && !albumMap.has(t.albumId)) {
      albumMap.set(t.albumId, {
        id: t.albumId,
        name: t.albumName,
        displayArtist: artist.value.name,
        cover_type: t.albumCoverType || null
      })
    }
  })
  return Array.from(albumMap.values())
})

const chartData = computed(() => {
  if (!artist.value) return []
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  artist.value.tracks.forEach((t) => {
    if (t.rating > 0) counts[t.rating]++
  })
  return Object.entries(counts).map(([star, count]) => ({ star: t('pages.details.artistStarLabel', { star }), count }))
})

const chartConfig = computed(() => ({
  count: { label: t('pages.details.artistRatingChartLabel'), color: 'var(--chart-1)' }
}))

const handleEdit = async () => {
  if (!artist.value?.id) return
  metadataEdit.clearQueue()
  await metadataEdit.fetchPreview('artist', artist.value.id)
}
</script>

<template>
  <div v-if="isLoading" class="p-16 flex flex-col items-center gap-4 text-muted-foreground">
    <div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    <p>{{ t('pages.details.artistLoading') }}</p>
  </div>

  <DetailLayout
    v-else-if="artist"
    :title="artist.name"
    :subtitle="t('pages.details.entityArtist')"
    :image-url="imageUrl"
    :stats="artistStats"
    :is-round-image="true"
  >
    <template #actions>
      <Button variant="outline" size="sm" @click="handleEdit">
        <Edit class="w-4 h-4 mr-2" />
        {{ t('common.edit') }}
      </Button>
    </template>

    <section v-if="artist.bio" class="max-w-4xl">
      <p class="text-sm md:text-base text-muted-foreground leading-relaxed">
        {{ artist.bio }}
      </p>
    </section>

    <section v-if="artistAlbums.length > 0" class="space-y-6">
      <SectionHeader :title="t('nav.albums')" />
      <AlbumGrid :albums="artistAlbums" />
    </section>

    <section v-if="artist.tracks && artist.tracks.length > 0" class="space-y-6">
      <SectionHeader :title="t('pages.details.sectionPopularTracks')" />
      <TrackListTable :tracks="artist.tracks" :show-artist="false" />
    </section>

    <section class="space-y-6">
      <SectionHeader :title="t('pages.details.sectionAnalytics')" />
      <div class="bg-card border rounded-xl p-6 max-w-md shadow-sm">
        <h3 class="text-sm font-bold text-muted-foreground mb-4">{{ t('pages.details.artistRatingChart') }}</h3>
        <ChartContainer :config="chartConfig" class="h-[200px]">
          <VisXYContainer :data="chartData">
            <VisStackedBar :x="(d) => d.star" :y="(d) => d.count" color="var(--chart-1)" />
            <VisAxis type="x" :grid-line="false" />
            <ChartTooltip />
          </VisXYContainer>
        </ChartContainer>
      </div>
    </section>

    <section class="space-y-6 pb-12">
      <SectionHeader :title="t('pages.details.sectionRelatedArtists')" />
      <div class="p-12 text-center border-2 border-dashed rounded-xl bg-muted/10 text-muted-foreground flex flex-col items-center gap-2">
        <Users class="w-8 h-8 opacity-50" />
        <span class="text-sm font-medium">{{ t('pages.details.artistComingSoon') }}</span>
      </div>
    </section>
  </DetailLayout>

  <div v-else class="p-16 text-center text-muted-foreground">{{ t('pages.details.artistNotFound') }}</div>
</template>
