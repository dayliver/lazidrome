<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useSyncArtistDetailWithLibrary } from '@/composables/useSyncArtistDetailWithLibrary'
import { useDocumentTitle } from '@/composables/useDocumentTitle'
import { formatArtistDocumentTitle } from '@/lib/documentTitle'
import { useScopedTracksPageQuery } from '@/composables/useScopedTracksPageQuery'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useCoverUrl } from '@/composables/useCoverUrl'
import { useLibraryStore } from '@/stores/library'
import { useMetadataEditStore } from '@/stores/metadataEdit'

import { Users, Edit, Loader2 } from 'lucide-vue-next'

import { VisXYContainer, VisStackedBar, VisAxis } from '@unovis/vue'
import { ChartContainer, ChartTooltip } from '@/components/ui/chart'
import DetailLayout from '@/components/layout/DetailLayout.vue'
import { Button } from '@/components/ui/button'

import TrackListTable from '@/components/shared/TrackListTable.vue'
import TrackListToolbar from '@/components/shared/TrackListToolbar.vue'
import AlbumGrid from '@/components/shared/AlbumGrid.vue'
import SectionHeader from '@/components/shared/SectionHeader.vue'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
const { t } = useI18n()

const route = useRoute()
const library = useLibraryStore()
const metadataEdit = useMetadataEditStore()

const { data: artist, isLoading } = useAsyncResource(
  () => route.params.id,
  async (id) => library.getArtistById(id)
)

useDocumentTitle(computed(() => (artist.value?.name ? formatArtistDocumentTitle(artist.value.name) : null)))

const shareMarkdownLabel = computed(() => {
  const name = artist.value?.name
  if (!name) return ''
  return t('share.artistLabel', { name })
})

useSyncArtistDetailWithLibrary(() => artist.value)

const artistScope = computed(() => ({ artistId: String(route.params.id ?? '') }))

const {
  query: trackQuery,
  searchInput: trackSearchInput,
  displayTracks,
  total: trackTotal,
  shown: trackShown,
  hasMore: tracksHasMore,
  isLoading: tracksLoading,
  isLoadMore: tracksLoadMore,
  loadMore: loadMoreTracks,
  sortOptions: trackSortOptions,
  setSort: setTrackSort,
  toggleOrder: toggleTrackOrder,
  toggleStarredFilter: toggleTrackStarredFilter,
  setMinRating: setTrackMinRating,
  resetFilters: resetTrackFilters,
  hasActiveFilters: hasActiveTrackFilters,
} = useScopedTracksPageQuery(artistScope, { presetKey: 'artist' })

const showTracksSection = computed(
  () =>
    Boolean(
      artist.value &&
        (trackTotal.value > 0 ||
          tracksLoading.value ||
          artist.value.tracks?.length ||
          (artist.value.trackCount ?? 0) > 0 ||
          hasActiveTrackFilters.value),
    ),
)

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
  <LoadingSpinner v-if="isLoading" :label="t('pages.details.artistLoading')" />

  <DetailLayout
    v-else-if="artist"
    :title="artist.name"
    :share-markdown-label="shareMarkdownLabel"
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

    <section v-if="showTracksSection" class="space-y-6">
      <SectionHeader :title="t('pages.details.sectionPopularTracks')" />
      <TrackListToolbar
        :query="trackQuery"
        :search-input="trackSearchInput"
        :total="trackTotal"
        :shown="trackShown"
        :sort-options="trackSortOptions"
        @update:search-input="trackSearchInput = $event"
        @update:sort="setTrackSort"
        @toggle-order="toggleTrackOrder"
        @toggle-starred="toggleTrackStarredFilter"
        @set-min-rating="setTrackMinRating"
        @reset-filters="resetTrackFilters"
      />
      <LoadingSpinner v-if="tracksLoading && !displayTracks.length" :label="t('pages.tracks.loading')" />
      <TrackListTable
        v-else-if="displayTracks.length"
        :tracks="displayTracks"
        :show-artist="false"
      />
      <div
        v-else-if="!tracksLoading"
        class="py-12 text-center space-y-3 border rounded-xl"
      >
        <p class="text-sm font-medium text-muted-foreground">{{ t('trackList.noResults') }}</p>
        <template v-if="hasActiveTrackFilters">
          <p class="text-xs text-muted-foreground px-4">{{ t('trackList.filteredEmptyHint') }}</p>
          <Button variant="outline" class="rounded-full" @click="resetTrackFilters">
            {{ t('trackList.resetFilters') }}
          </Button>
        </template>
      </div>
      <div v-if="tracksHasMore" class="flex justify-center pt-2">
        <Button variant="outline" class="rounded-full" :disabled="tracksLoadMore" @click="loadMoreTracks">
          <Loader2 v-if="tracksLoadMore" class="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
          {{ tracksLoadMore ? t('pages.tracks.loadingMore') : t('pages.tracks.loadMore') }}
        </Button>
      </div>
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
