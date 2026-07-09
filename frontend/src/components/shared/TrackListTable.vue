<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePlayerStore } from '@/stores/player'
import { formatTrackTime } from '@/lib/audio'
import { X, Trash2, ListMusic } from 'lucide-vue-next'
import PlaylistSelectModal from '@/components/playlist/PlaylistSelectModal.vue'
import TrackListTableDesktop from '@/components/shared/TrackListTableDesktop.vue'
import TrackListTableMobile from '@/components/shared/TrackListTableMobile.vue'
import TrackContextMenuHost from '@/components/shared/TrackContextMenuHost.vue'
import { useTrackListTable } from '@/composables/useTrackListTable'
import { useTrackContextMenu } from '@/composables/useTrackContextMenu'

const props = defineProps({
  tracks: { type: Array, required: true, default: () => [] },
  showCover: { type: Boolean, default: true },
  showArtist: { type: Boolean, default: true },
  showAlbum: { type: Boolean, default: true },
  selectable: { type: Boolean, default: true },
  playlistId: { type: String, default: null }
})

const {
  localTracks,
  selectedTrackIds,
  isPlaylistModalOpen,
  tracksToAddToPlaylist,
  isAllSelected,
  isSomeSelected,
  toggleSelectAll,
  toggleSelect,
  openPlaylistModal,
  onPlaylistAddSuccess,
  getTrackImageUrl,
  prefetchTrackStream,
  playTrack,
  goToArtist,
  goToAlbum,
  goToTrack,
  toggleStar,
  updateRating,
  fetchMetadata,
  getArtistList,
  renderStars,
  removeTrackFromPlaylist,
  removeSelectedFromPlaylist,
  onDragEnd
} = useTrackListTable(props)

const player = usePlayerStore()
const { t } = useI18n()
const nowPlayingTrackId = computed(() => player.currentTrack?.id ?? null)
const playerIsPlaying = computed(() => player.isPlaying)
const togglePlayerPlay = () => player.togglePlay()

const {
  open: contextMenuOpen,
  anchorX,
  anchorY,
  contextTrack,
  openAt,
  openFromTrigger,
} = useTrackContextMenu()
</script>

<template>
  <div class="w-full relative">
    <TrackListTableDesktop
      v-model:local-tracks="localTracks"
      :selected-track-ids="selectedTrackIds"
      :show-cover="showCover"
      :show-artist="showArtist"
      :show-album="showAlbum"
      :selectable="selectable"
      :playlist-id="playlistId"
      :is-all-selected="isAllSelected"
      :is-some-selected="isSomeSelected"
      :toggle-select-all="toggleSelectAll"
      :toggle-select="toggleSelect"
      :play-track="playTrack"
      :prefetch-track-stream="prefetchTrackStream"
      :on-drag-end="onDragEnd"
      :get-track-image-url="getTrackImageUrl"
      :toggle-star="toggleStar"
      :get-artist-list="getArtistList"
      :go-to-artist="goToArtist"
      :go-to-album="goToAlbum"
      :go-to-track="goToTrack"
      :format-track-time="formatTrackTime"
      :render-stars="renderStars"
      :update-rating="updateRating"
      :remove-track-from-playlist="removeTrackFromPlaylist"
      :open-playlist-modal="openPlaylistModal"
      :fetch-metadata="fetchMetadata"
      :now-playing-track-id="nowPlayingTrackId"
      :player-is-playing="playerIsPlaying"
      :toggle-play="togglePlayerPlay"
      :open-context-at="openAt"
      :open-context-from-trigger="openFromTrigger"
    />

    <TrackListTableMobile
      v-model:local-tracks="localTracks"
      :selected-track-ids="selectedTrackIds"
      :show-cover="showCover"
      :show-artist="showArtist"
      :show-album="showAlbum"
      :selectable="selectable"
      :playlist-id="playlistId"
      :is-all-selected="isAllSelected"
      :is-some-selected="isSomeSelected"
      :toggle-select-all="toggleSelectAll"
      :toggle-select="toggleSelect"
      :play-track="playTrack"
      :prefetch-track-stream="prefetchTrackStream"
      :on-drag-end="onDragEnd"
      :get-track-image-url="getTrackImageUrl"
      :toggle-star="toggleStar"
      :get-artist-list="getArtistList"
      :go-to-artist="goToArtist"
      :go-to-album="goToAlbum"
      :go-to-track="goToTrack"
      :format-track-time="formatTrackTime"
      :render-stars="renderStars"
      :update-rating="updateRating"
      :remove-track-from-playlist="removeTrackFromPlaylist"
      :open-playlist-modal="openPlaylistModal"
      :fetch-metadata="fetchMetadata"
      :now-playing-track-id="nowPlayingTrackId"
      :player-is-playing="playerIsPlaying"
      :open-context-at="openAt"
      :open-context-from-trigger="openFromTrigger"
    />

    <TrackContextMenuHost
      v-model:open="contextMenuOpen"
      :anchor-x="anchorX"
      :anchor-y="anchorY"
      :track="contextTrack"
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

    <Transition name="slide-up">
      <div v-if="selectedTrackIds.length > 0" class="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-[60] flex items-center bg-foreground text-background px-6 py-3 rounded-full shadow-2xl gap-5 font-sans">
        <div class="flex items-center gap-2">
          <span class="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground font-black text-xs">{{ selectedTrackIds.length }}</span>
          <span class="font-bold text-sm whitespace-nowrap">{{ t('trackTable.tracksSelected') }}</span>
        </div>
        <div class="w-px h-5 bg-background/20"></div>
        <button @click="openPlaylistModal()" class="text-sm font-bold flex items-center gap-2 hover:text-primary transition-colors whitespace-nowrap"><ListMusic class="w-4 h-4" /> {{ t('trackTable.addToPlaylistBulk') }}</button>
        <template v-if="playlistId">
          <div class="w-px h-5 bg-background/20"></div>
          <button @click="removeSelectedFromPlaylist" class="text-sm font-bold flex items-center gap-2 text-red-400 hover:text-red-500 transition-colors whitespace-nowrap"><Trash2 class="w-4 h-4" /> {{ t('trackTable.removeFromPlaylist') }}</button>
        </template>
        <button @click="selectedTrackIds = []" class="ml-2 text-muted-foreground hover:text-background p-1 focus:outline-none transition-colors" :title="t('trackTable.clearSelection')"><X class="w-5 h-5" /></button>
      </div>
    </Transition>

    <PlaylistSelectModal v-model:is-open="isPlaylistModalOpen" :track-ids="tracksToAddToPlaylist" @success="onPlaylistAddSuccess" />
  </div>
</template>

<style scoped>
input[type="checkbox"]:indeterminate {
  background-color: hsl(var(--primary));
  border-color: hsl(var(--primary));
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3 8h10' stroke='white' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E");
}
.slide-up-enter-active, .slide-up-leave-active { transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.slide-up-enter-from, .slide-up-leave-to { opacity: 0; transform: translate(-50%, 20px) scale(0.95); }

/* 드래그 앤 드롭 애니메이션 효과 부드럽게 */
.sortable-ghost { opacity: 0.5; background: hsl(var(--muted)); }
.sortable-drag { cursor: grabbing !important; }
</style>