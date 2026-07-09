<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useSyncTrackListWithLibrary } from '@/composables/useSyncTrackListWithLibrary'
import { useClientTrackListQuery } from '@/composables/useClientTrackListQuery'
import { useMixSnapshot } from '@/composables/useMixSnapshot'
import { useDocumentTitle } from '@/composables/useDocumentTitle'
import { formatPlaylistDocumentTitle } from '@/lib/documentTitle'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useCoverUrl } from '@/composables/useCoverUrl'
import { usePlaylistStore } from '@/stores/playlist'
import { usePlayerStore } from '@/stores/player'
import { toast } from 'vue-sonner'

import { useDurationLabel } from '@/composables/useDurationLabel'

import { Play, Shuffle, RefreshCw, ListMusic, Edit, Music } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import DetailLayout from '@/components/layout/DetailLayout.vue'
import TrackListTable from '@/components/shared/TrackListTable.vue'
import TrackListToolbar from '@/components/shared/TrackListToolbar.vue'
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue'

const { t } = useI18n()
const durationLabel = useDurationLabel()

const route = useRoute()
const router = useRouter()
const playlistStore = usePlaylistStore()
const player = usePlayerStore()

const isRefreshing = ref(false)
const forceFreshNextMix = ref(false)
const effectiveTracks = ref([])

const { data: playlist, isLoading, reload: reloadPlaylist } = useAsyncResource(
  () => route.params.id,
  async (id) => playlistStore.fetchPlaylistDetails(id),
)

useDocumentTitle(computed(() => (playlist.value?.name ? formatPlaylistDocumentTitle(playlist.value.name) : null)))

const shareMarkdownLabel = computed(() => {
  const name = playlist.value?.name
  if (!name) return ''
  return t('share.playlistLabel', { title: name })
})

const {
  isResolving: isMixResolving,
  resolveMixTracks,
} = useMixSnapshot()

watch(
  () => [playlist.value?.id, playlist.value?.type, playlist.value?.tracks],
  async () => {
    const pl = playlist.value
    if (!pl) {
      effectiveTracks.value = []
      return
    }
    if (pl.type !== 'mix') {
      effectiveTracks.value = pl.tracks || []
      return
    }

    const forceFresh = forceFreshNextMix.value
    forceFreshNextMix.value = false

    effectiveTracks.value = []
    effectiveTracks.value = await resolveMixTracks(pl, { forceFresh })
  },
)

useSyncTrackListWithLibrary(() => effectiveTracks.value)

const {
  query: trackQuery,
  searchInput: trackSearchInput,
  displayTracks,
  total: trackTotal,
  shown: trackShown,
  isManualOrder,
  sortOptions: trackSortOptions,
  setSort: setTrackSort,
  toggleOrder: toggleTrackOrder,
  toggleStarredFilter: toggleTrackStarredFilter,
  setMinRating: setTrackMinRating,
  resetFilters: resetTrackFilters,
} = useClientTrackListQuery(() => effectiveTracks.value, 'playlist')

const imageUrl = useCoverUrl('playlist', () => playlist.value?.id)

const canReorderPlaylist = computed(
  () => playlist.value?.type === 'list' && isManualOrder.value,
)

const playlistOrderLockedHint = computed(() =>
  playlist.value?.type === 'list' && !isManualOrder.value
    ? t('trackList.playlistOrderLocked')
    : '',
)

const totalDuration = computed(() =>
  effectiveTracks.value.reduce((acc, track) => acc + (track.duration || 0), 0),
)

const subtitleText = computed(() => {
  if (!playlist.value) return ''
  if (playlist.value.type === 'list') {
    return playlist.value.description || t('pages.details.playlistManual')
  }
  if (playlist.value.description) return playlist.value.description
  if (playlist.value.rules && playlist.value.rules.conditions?.length > 0) {
    return playlist.value.rules.conditions
      .map((c) => {
        const fieldName = c.field === 'rating' ? t('playlist.fieldRating') : c.field === 'tags' ? t('playlist.fieldTags') : c.field
        return `${fieldName} ${c.value}`
      })
      .join(' • ')
  }
  return t('pages.details.playlistSmartMix')
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

const refreshMix = async () => {
  isRefreshing.value = true
  forceFreshNextMix.value = true
  await reloadPlaylist()
  isRefreshing.value = false
}

const handleEdit = () => {
  toast.info(t('pages.details.playlistEditSoon'))
}
</script>

<template>
  <LoadingSpinner v-if="isLoading" :label="t('pages.details.playlistLoading')" />

  <DetailLayout
    v-else-if="playlist"
    :title="playlist.name"
    :share-markdown-label="shareMarkdownLabel"
    :subtitle="subtitleText"
    :is-round-image="false"
    :image-url="imageUrl"
    :stats="[
      { label: t('pages.details.statType'), value: playlist.type === 'mix' ? t('pages.details.playlistTypeMix') : t('pages.details.playlistTypeManual') },
      { label: t('pages.details.albumTracks'), value: effectiveTracks.length },
      { label: t('pages.details.albumTotalDuration'), value: durationLabel(totalDuration) }
    ]"
  >
    <template #actions>
      <Button variant="outline" size="sm" @click="handleEdit">
        <Edit class="w-4 h-4 mr-2" />
        {{ t('common.edit') }}
      </Button>
    </template>

    <div class="flex items-center gap-4 mb-4 px-2">
      <Button @click="playSequential" class="rounded-full shadow-lg px-8" :disabled="!displayTracks.length">
        <Play class="w-4 h-4 mr-2 fill-current" /> {{ t('pages.details.play') }}
      </Button>
      <Button @click="playShuffle" variant="outline" class="rounded-full px-8" :disabled="!displayTracks.length">
        <Shuffle class="w-4 h-4 mr-2" /> {{ t('pages.details.shuffle') }}
      </Button>

      <Button
        v-if="playlist.type === 'mix'"
        variant="secondary"
        class="rounded-full px-4 border shadow-sm transition-ui hover:bg-primary hover:text-primary-foreground"
        :disabled="isRefreshing || isMixResolving"
        @click="refreshMix"
      >
        <RefreshCw class="w-4 h-4 mr-2" :class="{ 'animate-spin': isRefreshing }" />
        {{ t('pages.details.reshuffleMix') }}
      </Button>
    </div>

    <LoadingSpinner
      v-if="playlist.type === 'mix' && isMixResolving && !effectiveTracks.length"
      :label="t('playlist.mixSnapshotLoading')"
    />

    <section v-else-if="effectiveTracks.length" class="space-y-4">
      <TrackListToolbar
        :query="trackQuery"
        :search-input="trackSearchInput"
        :total="trackTotal"
        :shown="trackShown"
        :sort-options="trackSortOptions"
        :order-locked-hint="playlistOrderLockedHint"
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
          :show-album="true"
          :show-cover="true"
          :playlist-id="canReorderPlaylist ? playlist.id : null"
        />
        <div
          v-else
          class="py-12 text-center text-sm font-medium text-muted-foreground border-t"
        >
          {{ t('trackList.noResults') }}
        </div>
      </div>
      <div class="px-2 text-[10px] text-muted-foreground opacity-50 text-right">
        {{ t('pages.details.albumTrackSummary', { count: effectiveTracks.length, duration: durationLabel(totalDuration) }) }}
      </div>
    </section>

    <div
      v-else-if="playlist.type === 'mix' && !isMixResolving"
      class="py-16 text-center border-2 border-dashed rounded-2xl bg-muted/5 text-muted-foreground"
    >
      <Music class="w-12 h-12 mx-auto opacity-30 mb-3" />
      <p class="font-bold">{{ t('trackList.noResults') }}</p>
    </div>
  </DetailLayout>

  <div
    v-else
    class="p-16 text-center text-muted-foreground flex flex-col items-center gap-4 border-2 border-dashed rounded-2xl m-8"
  >
    <ListMusic class="w-12 h-12 opacity-20" />
    <h2 class="text-xl font-bold text-foreground">{{ t('pages.details.playlistNotFound') }}</h2>
    <p class="text-sm">{{ t('pages.details.playlistNotFoundHint') }}</p>
    <Button variant="outline" class="mt-2" @click="router.push('/playlists')">{{ t('pages.details.backToPlaylists') }}</Button>
  </div>

</template>
