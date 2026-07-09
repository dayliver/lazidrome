<script setup>
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { useMetadataEditStore } from '@/stores/metadataEdit'
import { useDurationLabel } from '@/composables/useDurationLabel'
import SafeImage from '@/components/shared/SafeImage.vue'
import VirtualScrollGrid from '@/components/shared/VirtualScrollGrid.vue'
import { Play, MoreVertical, Shuffle, Info, Sparkles } from 'lucide-vue-next'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

defineProps({
  albums: {
    type: Array,
    required: true,
    default: () => [],
  },
})

const router = useRouter()
const library = useLibraryStore()
const player = usePlayerStore()
const metadataEdit = useMetadataEditStore()
const { t } = useI18n()
const durationLabel = useDurationLabel()

const playAlbumSequential = async (albumId) => {
  const album = await library.getAlbumById(albumId)
  const tracks = album?.tracks
  if (tracks?.length > 0) player.playNewQueue(tracks, 0)
}

const playAlbumShuffle = async (albumId) => {
  const album = await library.getAlbumById(albumId)
  const tracks = album?.tracks
  if (tracks?.length > 0) player.playAlbum(tracks, null, true)
}

const goToAlbumDetail = (albumId) => {
  router.push({ name: 'album-detail', params: { id: albumId } })
}

const fetchMetadata = (albumId) => {
  if (!albumId) return
  metadataEdit.fetchPreview('album', albumId)
}
</script>

<template>
  <VirtualScrollGrid :items="albums" class="pb-12">
    <template #item="{ item }">
      <div class="group flex flex-col gap-3">
        <div
          class="relative aspect-square w-full rounded-xl overflow-hidden bg-muted shadow-sm ring-1 ring-border cursor-pointer transition-all duration-300 group-hover:shadow-xl group-hover:-translate-y-1"
          @click="goToAlbumDetail(item.id)"
        >
          <SafeImage
            v-if="item.cover_type"
            sign-type="album"
            :sign-id="item.id"
            type="album"
            :alt="t('common.albumCoverAlt', { name: item.name })"
            class="absolute inset-0 w-full h-full transition-all duration-500 group-hover:scale-105 z-10"
          />

          <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-20">
            <button
              class="w-14 h-14 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              @click.stop="playAlbumSequential(item.id)"
            >
              <Play class="w-6 h-6 fill-current ml-1" />
            </button>
          </div>
        </div>

        <div class="flex flex-col px-1 min-w-0">
          <div class="flex items-start justify-between gap-2">
            <div class="flex flex-col min-w-0 flex-1 cursor-pointer" @click="goToAlbumDetail(item.id)">
              <span class="font-bold text-base leading-tight truncate group-hover:text-primary transition-colors" :title="item.name">
                {{ item.name }}
              </span>
              <span class="text-sm font-medium text-muted-foreground truncate mt-0.5" :title="item.displayArtist">
                {{ item.displayArtist || t('common.unknownArtist') }}
              </span>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button variant="ghost" size="icon" class="h-6 w-6 -mr-2 text-muted-foreground hover:text-foreground shrink-0" @click.stop>
                  <MoreVertical class="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" class="w-48">
                <DropdownMenuItem @click.stop="playAlbumShuffle(item.id)">
                  <Shuffle class="mr-2 h-4 w-4" /> {{ t('albumGrid.shufflePlay') }}
                </DropdownMenuItem>
                <DropdownMenuItem @click.stop="goToAlbumDetail(item.id)">
                  <Info class="mr-2 h-4 w-4" /> {{ t('albumGrid.albumInfo') }}
                </DropdownMenuItem>
                <DropdownMenuItem @click.stop="fetchMetadata(item.id)">
                  <Sparkles class="mr-2 h-4 w-4 text-rating" /> {{ t('albumGrid.updateMetadata') }}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div class="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground/70 font-medium font-mono">
            <span>{{ item.year || '-' }}</span>
            <span>•</span>
            <span>{{ t('common.trackCount', { count: item.trackCount || 0 }) }}</span>
            <span v-if="item.totalDuration">•</span>
            <span v-if="item.totalDuration">{{ durationLabel(item.totalDuration) }}</span>
          </div>
        </div>
      </div>
    </template>
  </VirtualScrollGrid>
</template>
