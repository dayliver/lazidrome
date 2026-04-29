<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSyncTrackListWithLibrary } from '@/composables/useSyncTrackListWithLibrary'
import { useAsyncResource } from '@/composables/useAsyncResource'
import { useLibraryStore } from '@/stores/library'
import { useMetadataEditStore } from '@/stores/metadataEdit'
import { usePlayerStore } from '@/stores/player'
import { useAuthStore } from '@/stores/auth'
import { getCoverUrl } from '@/lib/image'

import { formatDuration } from '@/lib/audio'

import { Play, Shuffle, Users, Edit } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import DetailLayout from '@/components/layout/DetailLayout.vue'

import TrackListTable from '@/components/shared/TrackListTable.vue'
import ArtistListTable from '@/components/shared/ArtistListTable.vue'
import SectionHeader from '@/components/shared/SectionHeader.vue'

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

useSyncTrackListWithLibrary(() => album.value?.tracks)

/** AlbumGrid와 동일: `cover_type`이 있을 때만 이미지 URL 부여 (불필요한 404·@error 방지) */
const getAlbumImageUrl = (id) => getCoverUrl(auth.serverUrl, 'album', id, auth.token)

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
  if (album.value?.tracks?.length > 0) {
    player.playNewQueue(album.value.tracks, 0)
  }
}

const playShuffle = () => {
  if (album.value?.tracks?.length > 0) {
    player.isShuffle = true
    player.playNewQueue(album.value.tracks, Math.floor(Math.random() * album.value.tracks.length))
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
    <p>앨범 정보를 불러오고 있습니다...</p>
  </div>

  <DetailLayout
    v-else-if="album"
    :title="album.name"
    :subtitle="album.displayArtist || 'Unknown Artist'"
    :is-round-image="false"
    :image-url="albumCoverUrl"
    :stats="[
      { label: '수록곡', value: album.tracks?.length || 0 },
      { label: '발매 연도', value: album.year || '-' },
      { label: '총 재생 시간', value: formatDuration(album.totalDuration) }
    ]"
  >
    <template #actions>
      <Button variant="outline" size="sm" @click="handleEdit">
        <Edit class="w-4 h-4 mr-2" />
        편집
      </Button>
    </template>

    <div class="flex items-center gap-4 mb-4 px-2">
      <Button @click="playSequential" class="rounded-full shadow-lg px-8">
        <Play class="w-4 h-4 mr-2 fill-current" /> 재생
      </Button>
      <Button @click="playShuffle" variant="outline" class="rounded-full px-8">
        <Shuffle class="w-4 h-4 mr-2" /> 셔플
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

    <section class="space-y-4">
      <div class="bg-card overflow-hidden">
        <TrackListTable :tracks="album.tracks" :show-album="false" :show-cover="false" />
      </div>
      <div v-if="album.tracks?.length > 0" class="px-2 text-[10px] text-muted-foreground opacity-50 text-right">
        총 {{ album.tracks.length }}곡 참여 • {{ formatDuration(album.totalDuration) }}
      </div>
    </section>

    <section v-if="albumArtists.length > 0" class="space-y-6 pb-12 mt-12">
      <SectionHeader title="Featured Artists">
        <template #icon>
          <Users class="w-6 h-6 text-primary" />
        </template>
      </SectionHeader>
      <ArtistListTable :artists="albumArtists" />
    </section>
  </DetailLayout>

  <div v-else class="p-16 text-center text-muted-foreground">앨범 정보를 찾을 수 없습니다.</div>
</template>
