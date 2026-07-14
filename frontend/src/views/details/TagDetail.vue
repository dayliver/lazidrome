<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useScopedTracksPageQuery } from '@/composables/useScopedTracksPageQuery'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useDocumentTitle } from '@/composables/useDocumentTitle'
import { formatTagDocumentTitle } from '@/lib/documentTitle'
import { useAuthStore } from '@/stores/auth'

import DetailLayout from '@/components/layout/DetailLayout.vue'
import SectionHeader from '@/components/shared/SectionHeader.vue'
import ArtistListTable from '@/components/shared/ArtistListTable.vue'
import AlbumGrid from '@/components/shared/AlbumGrid.vue'
import TrackListTable from '@/components/shared/TrackListTable.vue'
import TrackListToolbar from '@/components/shared/TrackListToolbar.vue'

import { Users, Disc, Music, Hash, Edit, Loader2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import TagEditDialog from '@/components/tags/TagEditDialog.vue'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'
const { t } = useI18n()

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const tagName = computed(() => {
  const raw = route.params.name
  return typeof raw === 'string' ? raw : ''
})

useDocumentTitle(computed(() => (tagName.value ? formatTagDocumentTitle(tagName.value) : null)))

const shareMarkdownLabel = computed(() => {
  if (!tagName.value) return ''
  return t('share.tagLabel', { name: tagName.value })
})

const { data: tagDetail, error: fetchError, isLoading, reload: loadTag } = useAsyncResource(
  () => tagName.value,
  async (name) => {
    if (!name) throw new Error(t('pages.details.tagNoName'))
    const qs = new URLSearchParams({ name })
    const res = await auth.fetchWithAuth(`/api/tags/detail?${qs.toString()}`)
    const body = await res.json()
    if (!res.ok) {
      throw new Error(body.error || t('pages.details.tagFetchFailed'))
    }
    const d = body.data || {}
    return {
      artists: d.artists || [],
      albums: d.albums || [],
      trackCount: Array.isArray(d.tracks) ? d.tracks.length : 0,
    }
  }
)

const artists = computed(() => tagDetail.value?.artists ?? [])
const albums = computed(() => tagDetail.value?.albums ?? [])
const detailTrackCount = computed(() => tagDetail.value?.trackCount ?? 0)

const loadError = computed(() => {
  if (!tagName.value) return t('pages.details.tagNoName')
  return fetchError.value
})

const tagScope = computed(() => ({ tag: tagName.value }))

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
} = useScopedTracksPageQuery(tagScope, { presetKey: 'tag' })

const showTracksSection = computed(
  () =>
    trackTotal.value > 0 ||
    tracksLoading.value ||
    detailTrackCount.value > 0 ||
    hasActiveTrackFilters.value,
)

const editOpen = ref(false)
const imageBust = ref(0)

const imageUrl = computed(() => {
  if (!tagName.value || !auth.serverUrl) return ''
  const base = auth.coverSrc('tag', tagName.value)
  if (!base) return ''
  return `${base}&_cb=${imageBust.value}`
})

const stats = computed(() => [
  { label: t('pages.details.statArtists'), value: artists.value.length },
  { label: t('pages.details.statAlbums'), value: albums.value.length },
  { label: t('pages.details.statTracks'), value: trackTotal.value || detailTrackCount.value },
])

const onEditSuccess = ({ renamed, newName, imageUpdated }) => {
  if (renamed && newName) {
    router.replace({ name: 'tag-detail', params: { name: newName } })
    return
  }
  if (imageUpdated) {
    imageBust.value += 1
    void loadTag()
  }
}
</script>

<template>
  <LoadingSpinner v-if="isLoading" :label="t('pages.details.tagLoading')" />

  <div v-else-if="loadError" class="p-16 text-center text-muted-foreground space-y-4 max-w-lg mx-auto">
    <Hash class="w-12 h-12 mx-auto opacity-30" />
    <p class="font-medium">{{ loadError }}</p>
    <button type="button" class="text-sm font-bold text-primary hover:underline" @click="router.push({ name: 'tags' })">
      {{ t('pages.details.backToTags') }}
    </button>
  </div>

  <DetailLayout
    v-else
    :title="tagName"
    :share-markdown-label="shareMarkdownLabel"
    :subtitle="t('pages.details.entityTag')"
    :is-round-image="false"
    :image-url="imageUrl"
    :stats="stats"
  >
    <template #actions>
      <Button variant="outline" size="sm" @click="editOpen = true">
        <Edit class="w-4 h-4 mr-2" />
        {{ t('common.edit') }}
      </Button>
    </template>

    <section v-if="artists.length > 0" class="space-y-6">
      <SectionHeader :title="t('nav.artists')">
        <template #icon>
          <Users class="w-6 h-6 text-primary" />
        </template>
      </SectionHeader>
      <div class="bg-card overflow-hidden border rounded-xl shadow-sm">
        <ArtistListTable :artists="artists" />
      </div>
    </section>

    <section v-if="albums.length > 0" class="space-y-6">
      <SectionHeader :title="t('nav.albums')">
        <template #icon>
          <Disc class="w-6 h-6 text-primary" />
        </template>
      </SectionHeader>
      <AlbumGrid :albums="albums" />
    </section>

    <section v-if="showTracksSection" class="space-y-6 pb-12">
      <SectionHeader :title="t('nav.tracks')">
        <template #icon>
          <Music class="w-6 h-6 text-primary" />
        </template>
      </SectionHeader>
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
      <div class="bg-card overflow-hidden border rounded-xl shadow-sm">
        <LoadingSpinner v-if="tracksLoading && !displayTracks.length" :label="t('pages.tracks.loading')" />
        <TrackListTable v-else-if="displayTracks.length" :tracks="displayTracks" />
        <div
          v-else-if="!tracksLoading"
          class="py-12 text-center space-y-3"
        >
          <p class="text-sm font-medium text-muted-foreground">{{ t('trackList.noResults') }}</p>
          <template v-if="hasActiveTrackFilters">
            <p class="text-xs text-muted-foreground px-4">{{ t('trackList.filteredEmptyHint') }}</p>
            <Button variant="outline" class="rounded-full" @click="resetTrackFilters">
              {{ t('trackList.resetFilters') }}
            </Button>
          </template>
        </div>
      </div>
      <div v-if="tracksHasMore" class="flex justify-center pt-2">
        <Button variant="outline" class="rounded-full" :disabled="tracksLoadMore" @click="loadMoreTracks">
          <Loader2 v-if="tracksLoadMore" class="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
          {{ tracksLoadMore ? t('pages.tracks.loadingMore') : t('pages.tracks.loadMore') }}
        </Button>
      </div>
    </section>

    <div
      v-if="!artists.length && !albums.length && !showTracksSection"
      class="py-16 text-center border border-dashed rounded-xl bg-muted/5 text-muted-foreground"
    >
      <p class="font-bold">{{ t('pages.details.tagEmpty') }}</p>
      <p class="text-sm mt-2">{{ t('pages.details.tagEmptyHint') }}</p>
    </div>
  </DetailLayout>

  <TagEditDialog v-model:is-open="editOpen" :tag-name="tagName" @success="onEditSuccess" />
</template>
