<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useSyncTrackListWithLibrary } from '@/composables/useSyncTrackListWithLibrary'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useCoverUrl } from '@/composables/useCoverUrl'
import { usePlaylistStore } from '@/stores/playlist'
import { usePlayerStore } from '@/stores/player'
import { toast } from 'vue-sonner'

import { useDurationLabel } from '@/composables/useDurationLabel'

import { Play, Shuffle, RefreshCw, ListMusic, Edit } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import DetailLayout from '@/components/layout/DetailLayout.vue'
import TrackListTable from '@/components/shared/TrackListTable.vue'
const { t } = useI18n()

const route = useRoute()
const router = useRouter()
const playlistStore = usePlaylistStore()
const player = usePlayerStore()

const isRefreshing = ref(false)

const { data: playlist, isLoading, reload: reloadPlaylist } = useAsyncResource(
  () => route.params.id,
  async (id) => playlistStore.fetchPlaylistDetails(id)
)

useSyncTrackListWithLibrary(() => playlist.value?.tracks)

const imageUrl = useCoverUrl('playlist', () => playlist.value?.id)

const totalDuration = computed(() => {
  if (!playlist.value?.tracks) return 0
  return playlist.value.tracks.reduce((acc, track) => acc + (track.duration || 0), 0)
})

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
  if (playlist.value?.tracks?.length > 0) {
    player.playNewQueue(playlist.value.tracks, 0)
  }
}

const playShuffle = () => {
  if (playlist.value?.tracks?.length > 0) {
    player.isShuffle = true
    player.playNewQueue(playlist.value.tracks, Math.floor(Math.random() * playlist.value.tracks.length))
  }
}

const refreshMix = async () => {
  isRefreshing.value = true
  await reloadPlaylist()
  isRefreshing.value = false
}

const handleEdit = () => {
  toast.info(t('pages.details.playlistEditSoon'))
}
</script>

<template>
  <div v-if="isLoading" class="p-16 flex flex-col items-center gap-4 text-muted-foreground">
    <div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    <p>{{ t('pages.details.playlistLoading') }}</p>
  </div>

  <DetailLayout
    v-else-if="playlist"
    :title="playlist.name"
    :subtitle="subtitleText"
    :is-round-image="false"
    :image-url="imageUrl"
    :stats="[
      { label: t('pages.details.statType'), value: playlist.type === 'mix' ? t('pages.details.playlistTypeMix') : t('pages.details.playlistTypeManual') },
      { label: t('pages.details.albumTracks'), value: playlist.tracks?.length || 0 },
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
      <Button @click="playSequential" class="rounded-full shadow-lg px-8">
        <Play class="w-4 h-4 mr-2 fill-current" /> {{ t('pages.details.play') }}
      </Button>
      <Button @click="playShuffle" variant="outline" class="rounded-full px-8">
        <Shuffle class="w-4 h-4 mr-2" /> {{ t('pages.details.shuffle') }}
      </Button>

      <Button
        v-if="playlist.type === 'mix'"
        variant="secondary"
        class="rounded-full px-4 border shadow-sm transition-all hover:bg-purple-500 hover:text-white"
        :disabled="isRefreshing"
        @click="refreshMix"
      >
        <RefreshCw class="w-4 h-4 mr-2" :class="{ 'animate-spin': isRefreshing }" />
        {{ t('pages.details.reshuffleMix') }}
      </Button>
    </div>

    <section class="space-y-4">
      <div class="bg-card overflow-hidden">
        <TrackListTable
          :tracks="playlist.tracks"
          :show-album="true"
          :show-cover="true"
          :playlist-id="playlist.type === 'list' ? playlist.id : null"
        />
      </div>
      <div v-if="playlist.tracks?.length > 0" class="px-2 text-[10px] text-muted-foreground opacity-50 text-right">
        {{ t('pages.details.albumTrackSummary', { count: playlist.tracks.length, duration: durationLabel(totalDuration) }) }}
      </div>
    </section>
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
