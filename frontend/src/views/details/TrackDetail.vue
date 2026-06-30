<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useSyncTrackDetailWithLibrary } from '@/composables/useSyncTrackDetailWithLibrary'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useLibraryStore } from '@/stores/library'
import { useMetadataEditStore } from '@/stores/metadataEdit'
import { usePlaybackSyncStore } from '@/stores/playbackSync.js'
import { useAuthStore } from '@/stores/auth'
import { formatTrackTime, parseRoles } from '@/lib/audio'

import { Play, Edit, Disc, Users, ListMusic, Zap, FolderOpen, Heart, RefreshCw } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import DetailLayout from '@/components/layout/DetailLayout.vue'
import AlbumGrid from '@/components/shared/AlbumGrid.vue'
import ArtistListTable from '@/components/shared/ArtistListTable.vue'
import SectionHeader from '@/components/shared/SectionHeader.vue'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import SafeImage from '@/components/shared/SafeImage.vue'
import TrackReplaceAudioDialog from '@/components/tracks/TrackReplaceAudioDialog.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const library = useLibraryStore()
const metadataEdit = useMetadataEditStore()
const playbackSync = usePlaybackSyncStore()
const auth = useAuthStore()

const { data, isLoading, reload } = useAsyncResource(
  () => route.params.id,
  async (id) => {
    const [trackData, artistsData] = await Promise.all([
      library.getTrackById(id),
      library.getArtists(),
    ])
    return { track: trackData, allArtists: artistsData || [] }
  }
)

const track = computed(() => data.value?.track ?? null)
const allArtists = computed(() => data.value?.allArtists ?? [])

useSyncTrackDetailWithLibrary(() => data.value?.track ?? null)

const trackCoverUrl = computed(() => {
  const tr = track.value
  if (!tr?.id || (!tr.custom_cover_type && !tr.albumCoverType)) return ''
  return auth.coverSrc('track', tr.id)
})

const trackStats = computed(() => {
  if (!track.value) return []
  return [
    { label: t('pages.details.trackDuration'), value: formatTrackTime(track.value.duration) },
    { label: t('pages.details.albumYear'), value: track.value.year || '-' },
    { label: t('trackTable.playCount'), value: track.value.play_count || 0 },
    {
      label: t('trackTable.rating'),
      value: track.value.rating ? `${track.value.rating} / 5` : '-',
    },
  ]
})

const trackArtists = computed(() => {
  if (!track.value?.artists?.length || !allArtists.value.length) return []
  const ids = new Set(track.value.artists.map((a) => a.id))
  return allArtists.value.filter((a) => ids.has(a.id))
})

const trackAlbums = computed(() => {
  if (!track.value?.albums?.length) return []
  const artistLabel = track.value.artist || t('common.unknownArtist')
  return track.value.albums.map((a) => ({
    id: a.id,
    name: a.name,
    year: a.year,
    cover_type: a.cover_type,
    displayArtist: artistLabel,
  }))
})

const trackPlaylists = computed(() => track.value?.playlists ?? [])

const fileDirPath = computed(() => {
  const p = track.value?.filePath
  if (!p) return ''
  const parts = String(p).replace(/\\/g, '/').split('/')
  parts.pop()
  return parts.join('/')
})

const renderStars = (rating) => '★'.repeat(rating || 0) + '☆'.repeat(5 - (rating || 0))

const playTrack = async () => {
  if (!track.value?.id) return
  const [fullTrack] = await library.fetchTracksByIds([track.value.id])
  if (fullTrack) void playbackSync.playTracks([fullTrack], 0)
}

const toggleStar = async () => {
  if (!track.value) return
  const newStatus = !track.value.starred
  track.value.starred = newStatus
  await library.toggleTrackStar(track.value.id, newStatus)
}

const updateRating = async (rating) => {
  if (!track.value) return
  track.value.rating = rating
  await library.updateTrackRating(track.value.id, rating)
}

const handleEdit = async () => {
  if (!track.value?.id) return
  metadataEdit.clearQueue()
  await metadataEdit.fetchPreview('track', track.value.id)
}

const goToPlaylist = (id) => {
  router.push({ name: 'playlist-detail', params: { id } })
}

const goToFiles = () => {
  if (!fileDirPath.value) return
  router.push({ name: 'files', query: { path: fileDirPath.value } })
}

const artistRolesLabel = (artistId) => {
  const entry = track.value?.artists?.find((a) => a.id === artistId)
  if (!entry?.role_mask) return ''
  return parseRoles(entry.role_mask).join(', ')
}

const replaceDialogOpen = ref(false)

const onAudioReplaced = async () => {
  await reload()
}
</script>

<template>
  <div v-if="isLoading" class="p-16 flex flex-col items-center gap-4 text-muted-foreground">
    <div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    <p>{{ t('pages.details.trackLoading') }}</p>
  </div>

  <DetailLayout
    v-else-if="track"
    :title="track.title"
    split-parenthetical-title
    :subtitle="track.artist || t('common.unknownArtist')"
    :is-round-image="false"
    :image-url="trackCoverUrl"
    :stats="trackStats"
  >
    <template #actions>
      <div class="flex items-center gap-2">
        <button
          class="p-2 rounded-full hover:bg-muted transition-colors focus:outline-none"
          @click="toggleStar"
        >
          <Heart
            class="w-5 h-5"
            :class="track.starred ? 'text-red-500 fill-current' : 'text-muted-foreground'"
          />
        </button>
        <Popover>
          <PopoverTrigger as-child>
            <button
              class="px-3 py-2 rounded-full hover:bg-muted transition-colors focus:outline-none text-yellow-500 text-sm tracking-widest"
            >
              {{ renderStars(track.rating) }}
            </button>
          </PopoverTrigger>
          <PopoverContent class="w-auto p-2" align="end">
            <div class="flex gap-1">
              <button
                v-for="star in 5"
                :key="star"
                class="text-2xl hover:scale-125 transition-transform focus:outline-none"
                :class="star <= (track.rating || 0) ? 'text-yellow-500' : 'text-muted'"
                @click="updateRating(star)"
              >
                ★
              </button>
            </div>
          </PopoverContent>
        </Popover>
        <Button variant="outline" size="sm" @click="handleEdit">
          <Edit class="w-4 h-4 mr-2" />
          {{ t('common.edit') }}
        </Button>
      </div>
    </template>

    <div class="flex items-center gap-4 mb-4 px-2">
      <Button @click="playTrack" class="rounded-full shadow-lg px-8">
        <Play class="w-4 h-4 mr-2 fill-current" /> {{ t('pages.details.play') }}
      </Button>
    </div>

    <div v-if="track.tags && track.tags.length > 0" class="flex flex-wrap gap-2 px-2 mb-6">
      <span
        v-for="tag in track.tags"
        :key="tag"
        class="px-3 py-1.5 bg-muted text-muted-foreground text-[10px] font-black rounded-md uppercase tracking-wider border hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
        @click="router.push({ name: 'tag-detail', params: { name: tag } })"
      >
        #{{ tag }}
      </span>
    </div>

    <div v-if="track.genre" class="px-2 mb-6 text-sm text-muted-foreground">
      <span class="font-bold uppercase text-[10px] tracking-wider mr-2">{{ t('pages.details.trackGenre') }}</span>
      {{ track.genre }}
    </div>

    <section v-if="trackAlbums.length > 0" class="space-y-6 pb-12">
      <SectionHeader :title="t('pages.details.sectionAlbums')">
        <template #icon>
          <Disc class="w-6 h-6 text-primary" />
        </template>
      </SectionHeader>
      <AlbumGrid :albums="trackAlbums" />
    </section>

    <section v-if="trackArtists.length > 0" class="space-y-6 pb-12 mt-12">
      <SectionHeader :title="t('pages.details.sectionFeaturedArtists')">
        <template #icon>
          <Users class="w-6 h-6 text-primary" />
        </template>
      </SectionHeader>
      <ArtistListTable :artists="trackArtists" />
      <div
        v-if="track.artists?.some((a) => a.role_mask)"
        class="px-2 text-xs text-muted-foreground space-y-1"
      >
        <p
          v-for="a in track.artists.filter((x) => x.role_mask)"
          :key="`role-${a.id}`"
        >
          <span class="font-semibold text-foreground">{{ a.name }}</span>
          — {{ artistRolesLabel(a.id) }}
        </p>
      </div>
    </section>

    <section v-if="trackPlaylists.length > 0" class="space-y-6 pb-12 mt-12">
      <SectionHeader :title="t('pages.details.sectionPlaylists')">
        <template #icon>
          <ListMusic class="w-6 h-6 text-primary" />
        </template>
      </SectionHeader>
      <div class="bg-card overflow-hidden">
        <Table class="border-b">
          <TableHeader>
            <TableRow class="bg-muted/30">
              <TableHead class="w-16"></TableHead>
              <TableHead>{{ t('playlistTable.info') }}</TableHead>
              <TableHead class="w-32 text-center">{{ t('pages.details.statType') }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="pl in trackPlaylists"
              :key="pl.id"
              class="cursor-pointer hover:bg-muted/50"
              @click="goToPlaylist(pl.id)"
            >
              <TableCell>
                <div class="w-12 h-12 rounded-md overflow-hidden bg-muted border flex items-center justify-center">
                  <SafeImage
                    v-if="pl.cover_type"
                    :src="auth.coverSrc('playlist', pl.id)"
                    type="album"
                    class="w-full h-full object-cover"
                  />
                  <ListMusic v-else class="w-5 h-5 text-muted-foreground/50" />
                </div>
              </TableCell>
              <TableCell>
                <span class="font-bold hover:text-primary transition-colors">{{ pl.name }}</span>
              </TableCell>
              <TableCell class="text-center text-xs font-bold text-muted-foreground">
                <span v-if="pl.type === 'mix'" class="inline-flex items-center gap-1">
                  <Zap class="w-3 h-3" /> {{ t('pages.details.playlistTypeMix') }}
                </span>
                <span v-else class="inline-flex items-center gap-1">
                  <ListMusic class="w-3 h-3" /> {{ t('pages.details.playlistTypeManual') }}
                </span>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </section>

    <section v-if="track.filePath" class="space-y-4 pb-12 mt-12">
      <SectionHeader :title="t('pages.details.sectionFileLocation')">
        <template #icon>
          <FolderOpen class="w-6 h-6 text-primary" />
        </template>
      </SectionHeader>
      <div class="px-2">
        <p class="text-sm font-mono text-muted-foreground break-all">{{ track.filePath }}</p>
        <div class="flex flex-wrap items-center gap-2 mt-2">
          <Button v-if="fileDirPath" variant="link" class="px-0" @click="goToFiles">
            {{ t('pages.details.openInFiles') }}
          </Button>
          <Button variant="outline" size="sm" @click="replaceDialogOpen = true">
            <RefreshCw class="w-4 h-4 mr-2" />
            {{ t('pages.details.replaceAudio.title') }}
          </Button>
        </div>
      </div>
    </section>

    <TrackReplaceAudioDialog
      v-model:open="replaceDialogOpen"
      :track-id="track.id"
      :track-title="track.title"
      @replaced="onAudioReplaced"
    />
  </DetailLayout>

  <div v-else class="p-16 text-center text-muted-foreground">{{ t('pages.details.trackNotFound') }}</div>
</template>
