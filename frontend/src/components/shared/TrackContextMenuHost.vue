<script setup>
import { watch } from 'vue'
import TrackContextMenuContent from '@/components/shared/TrackContextMenuContent.vue'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useTrackTags } from '@/composables/useTrackTags'

const open = defineModel('open', { type: Boolean, default: false })

const props = defineProps({
  anchorX: { type: Number, default: 0 },
  anchorY: { type: Number, default: 0 },
  track: { type: Object, default: null },
  showArtist: { type: Boolean, default: true },
  showAlbum: { type: Boolean, default: true },
  playlistId: { type: String, default: null },
  toggleStar: { type: Function, required: true },
  updateRating: { type: Function, required: true },
  goToTrack: { type: Function, required: true },
  goToAlbum: { type: Function, required: true },
  goToArtist: { type: Function, required: true },
  openPlaylistModal: { type: Function, required: true },
  removeTrackFromPlaylist: { type: Function, default: null },
  fetchMetadata: { type: Function, required: true },
})

const { fetchTags } = useTrackTags()

watch(open, (isOpen) => {
  if (isOpen) void fetchTags()
})
</script>

<template>
  <DropdownMenu v-model:open="open">
    <DropdownMenuTrigger as-child>
      <span
        class="fixed z-[100] w-px h-px pointer-events-none opacity-0"
        :style="{ left: `${anchorX}px`, top: `${anchorY}px` }"
        aria-hidden="true"
      />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" class="w-52">
      <TrackContextMenuContent
        v-if="track"
        :track="track"
        :show-artist="showArtist"
        :show-album="showAlbum"
        :playlist-id="playlistId"
        :toggle-star="toggleStar"
        :update-rating="updateRating"
        :go-to-track="goToTrack"
        :go-to-album="goToAlbum"
        :go-to-artist="goToArtist"
        :open-playlist-modal="openPlaylistModal"
        :remove-track-from-playlist="removeTrackFromPlaylist"
        :fetch-metadata="fetchMetadata"
      />
    </DropdownMenuContent>
  </DropdownMenu>
</template>
