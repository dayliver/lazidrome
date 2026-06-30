<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useSyncTrackListWithLibrary } from '@/composables/useSyncTrackListWithLibrary'
import { useSyncAlbumDetailWithLibrary } from '@/composables/useSyncAlbumDetailWithLibrary'
import { useClientTrackListQuery } from '@/composables/useClientTrackListQuery'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useLibraryStore } from '@/stores/library'
import { useMetadataEditStore } from '@/stores/metadataEdit'
import { usePlayerStore } from '@/stores/player'
import { useAuthStore } from '@/stores/auth'

import { useDurationLabel } from '@/composables/useDurationLabel'

import { Play, Shuffle, Users, Edit } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import DetailLayout from '@/components/layout/DetailLayout.vue'

import TrackListTable from '@/components/shared/TrackListTable.vue'
import TrackListToolbar from '@/components/shared/TrackListToolbar.vue'
import ArtistListTable from '@/components/shared/ArtistListTable.vue'
import SectionHeader from '@/components/shared/SectionHeader.vue'
const { t } = useI18n()
const durationLabel = useDurationLabel()

const route = useRoute()
const router = useRouter()
const library = useLibraryStore()
const metadataEdit = useMetadataEditStore()
const player = usePlayerStore()
const auth = useAuthStore()

const { data, isLoading } = useAsyncResource(
  () => route.params.id,
  async (id) => {
    const [albumData, artistsData] = await Promise.all([library.getAlbumById(id), library.getArtists()])
    return { album: albumData, allArtists: artistsData || [] }
  }
)

const album = computed(() => data.value?.album ?? null)
const allArtists = computed(() => data.value?.allArtists ?? [])

useSyncAlbumDetailWithLibrary(() => data.value?.album ?? null)
useSyncTrackListWithLibrary(() => album.value?.tracks)

const {
  query: trackQuery,
  searchInput: trackSearchInput,
  displayTracks,
  total: trackTotal,
  shown: trackShown,
  sortOptions: trackSortOptions,
  setSort: setTrackSort,
  toggleOrder: toggleTrackOrder,
  toggleStarredFilter: toggleTrackStarredFilter,
  setMinRating: setTrackMinRating,
  resetFilters: resetTrackFilters,
} = useClientTrackListQuery(() => album.value?.tracks, 'album')

/** AlbumGrid와 동일: `cover_type`이 있을 때만 이미지 URL 부여 (불필요한 404·@error 방지) */
const getAlbumImageUrl = (id) => auth.coverSrc('album', id)

const albumCoverUrl = computed(() => {
  const a = data.value?.album
  // serverUrl이 ''이면 상대 경로 `/api/images/...` (AlbumGrid·getCoverUrl와 동일). !serverUrl 로 막지 않음.
  if (!a?.id || !a.cover_type) return ''
  return getAlbumImageUrl(a.id)
})

const albumArtists = computed(() => {
  if (!album.value?.tracks || !allArtists.value.length) return []

  const artistNames = new Set()
  album.value.tracks.forEach((t) => {
    if (t.artist) {
      t.artist.split(', ').forEach((name) => artistNames.add(name))
    }
  })

  return allArtists.value.filter((a) => artistNames.has(a.name))
})

const playSequential = () => {
  if (displayTracks.value.length > 0) {
    player.playNewQueue(displayTracks.value, 0)
  }
}

const playShuffle = () => {
  if (displayTracks.value.length > 0) {
    player.isShuffle = true
    player.playNewQueue(displayTracks.value, Math.floor(Math.random() * displayTracks.value.length))
  }
}

const handleEdit = async () => {
  if (!album.value?.id) return
  metadataEdit.clearQueue()
  await metadataEdit.fetchPreview('album', album.value.id)
}
</script>

<template>
  <div v-if="isLoading" class="p-16 flex flex-col items-center gap-4 text-muted-foreground">
    <div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    <p>{{ t('pages.details.albumLoading') }}</p>
  </div>

  <DetailLayout
    v-else-if="album"
    :title="album.name"
    split-parenthetical-title
    :subtitle="album.displayArtist || t('common.unknownArtist')"
    :is-round-image="false"
    :image-url="albumCoverUrl"
    :stats="[
      { label: t('pages.details.albumTracks'), value: album.tracks?.length || 0 },
      { label: t('pages.details.albumYear'), value: album.year || '-' },
      { label: t('pages.details.albumTotalDuration'), value: durationLabel(album.totalDuration) }
    ]"
  >
    <template #actions>
      <Button variant="outline" size="sm" @click="handleEdit">
        <Edit class="w-4 h-4 mr-2" />
        {{ t('common.edit') }}
      </Button>
    </template>

    <div class="flex items-center gap-4 mb-4 px-2">
      <Button @click="playSequential" class="rounded-full shadow-lg px-8">
        <Play class="w-4 h-4 mr-2 fill-current" /> {{ t('pages.details.play') }}
      </Button>
      <Button @click="playShuffle" variant="outline" class="rounded-full px-8">
        <Shuffle class="w-4 h-4 mr-2" /> {{ t('pages.details.shuffle') }}
      </Button>
    </div>

    <div v-if="album.tags && album.tags.length > 0" class="flex flex-wrap gap-2 px-2 mb-6">
      <span
        v-for="tag in album.tags"
        :key="tag"
        class="px-3 py-1.5 bg-muted text-muted-foreground text-[10px] font-black rounded-md uppercase tracking-wider border hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
        @click="router.push({ name: 'tag-detail', params: { name: tag } })"
      >
        #{{ tag }}
      </span>
    </div>

    <section v-if="album.tracks?.length" class="space-y-4">
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
      <div class="bg-card overflow-hidden">
        <TrackListTable
          v-if="displayTracks.length"
          :tracks="displayTracks"
          :show-album="false"
          :show-cover="false"
        />
        <div
          v-else
          class="py-12 text-center text-sm font-medium text-muted-foreground border-t"
        >
          {{ t('trackList.noResults') }}
        </div>
      </div>
      <div v-if="album.tracks?.length > 0" class="px-2 text-[10px] text-muted-foreground opacity-50 text-right">
        {{ t('pages.details.albumTrackSummary', { count: album.tracks.length, duration: durationLabel(album.totalDuration) }) }}
      </div>
    </section>

    <section v-if="albumArtists.length > 0" class="space-y-6 pb-12 mt-12">
      <SectionHeader :title="t('pages.details.sectionFeaturedArtists')">
        <template #icon>
          <Users class="w-6 h-6 text-primary" />
        </template>
      </SectionHeader>
      <ArtistListTable :artists="albumArtists" />
    </section>
  </DetailLayout>

  <div v-else class="p-16 text-center text-muted-foreground">{{ t('pages.details.albumNotFound') }}</div>
</template>
