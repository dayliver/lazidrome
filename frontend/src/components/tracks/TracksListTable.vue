<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Table, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import {
  Heart,
  MoreVertical,
  Disc,
  ListMusic,
  ChevronUp,
  ChevronDown,
  X,
} from 'lucide-vue-next'
import SafeImage from '@/components/shared/SafeImage.vue'
import TrackPlayingMarker from '@/components/shared/TrackPlayingMarker.vue'
import TrackContextMenuHost from '@/components/shared/TrackContextMenuHost.vue'
import PlaylistSelectModal from '@/components/playlist/PlaylistSelectModal.vue'
import { useTrackListTable } from '@/composables/useTrackListTable'
import { useTrackContextMenu } from '@/composables/useTrackContextMenu'
import { usePlayerStore } from '@/stores/player'
import { formatLocaleDateTime } from '@/lib/localeFormat'
import { TRACKS_PAGE_SORT_COLUMNS } from '@/lib/trackListQuery'

const props = defineProps({
  tracks: { type: Array, required: true, default: () => [] },
  showCover: { type: Boolean, default: true },
  showArtist: { type: Boolean, default: true },
  showAlbum: { type: Boolean, default: true },
  selectable: { type: Boolean, default: true },
  playlistId: { type: String, default: null },
  sortState: { type: Function, required: true },
  sortPriority: { type: Function, required: true },
  activeSortCount: { type: Number, default: 0 },
})

const emit = defineEmits(['toggle-sort'])

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
  clearSelection,
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

function activeNow(trackId) {
  return nowPlayingTrackId.value != null && String(nowPlayingTrackId.value) === String(trackId)
}

function splitTrackTitle(title) {
  const raw = String(title ?? '')
  const m = raw.match(/^(.*?)(\s*(\([^)]*\)\s*)+)$/)
  if (!m) return { main: raw, suffix: '' }
  const suffix = (m[2] || '')
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return {
    main: m[1].trimEnd() || raw,
    suffix,
  }
}

function artistLabel(artist) {
  return getArtistList(artist).join(', ')
}

function formatScannedAt(value) {
  if (!value) return '—'
  return formatLocaleDateTime(String(value), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="w-full relative">
    <div class="hidden md:block pb-2">
      <Table class="border-b table-fixed">
        <TableHeader>
          <TableRow class="bg-muted/30">
            <TableHead class="w-10 text-center">
              <input
                type="checkbox"
                :checked="isAllSelected"
                :indeterminate="isSomeSelected"
                class="w-4 h-4 rounded border-muted-foreground/30 accent-primary cursor-pointer"
                @change="toggleSelectAll"
              />
            </TableHead>
            <TableHead class="w-[50px] text-center">#</TableHead>
            <TableHead class="w-14 text-center">{{ t('trackTable.cover') }}</TableHead>

            <TableHead
              v-for="col in TRACKS_PAGE_SORT_COLUMNS"
              :key="col.key"
              :class="{
                'max-w-0 text-left': col.key === 'title' || col.key === 'artist' || col.key === 'album',
                'text-center w-24 shrink-0': col.key === 'play_count',
                'text-center w-28 shrink-0': col.key === 'rating',
                'text-center w-36 shrink-0': col.key === 'scanned_at',
              }"
            >
              <button
                type="button"
                class="inline-flex items-center gap-1 w-full min-w-0 font-bold text-xs uppercase tracking-wide hover:text-primary transition-colors"
                :class="col.key === 'title' || col.key === 'artist' || col.key === 'album' ? 'justify-start' : 'justify-center'"
                @click="emit('toggle-sort', col.key)"
              >
                <span class="truncate">{{ t(col.labelKey) }}</span>
                <span class="inline-flex flex-col -space-y-1">
                  <ChevronUp
                    class="w-3 h-3"
                    :class="sortState(col.key) === 'asc' ? 'text-primary' : 'text-muted-foreground/30'"
                  />
                  <ChevronDown
                    class="w-3 h-3"
                    :class="sortState(col.key) === 'desc' ? 'text-primary' : 'text-muted-foreground/30'"
                  />
                </span>
                <span
                  v-if="sortState(col.key) && activeSortCount > 1"
                  class="text-[9px] font-mono text-primary/80"
                >{{ sortPriority(col.key) }}</span>
              </button>
            </TableHead>

            <TableHead class="w-12" />
          </TableRow>
        </TableHeader>

        <tbody class="[&_tr:last-child]:border-0">
          <TableRow
            v-for="(item, index) in localTracks"
            :key="item.id"
            class="hover:bg-muted/50 transition-colors group cursor-pointer"
            :class="{
              'bg-primary/5': selectedTrackIds.includes(item.id),
              'bg-primary/[0.08]': activeNow(item.id),
            }"
            @click="playTrack(index)"
            @contextmenu.prevent="openAt($event, item)"
            @mouseenter="prefetchTrackStream?.(item)"
          >
            <TableCell class="text-center" @click.stop>
              <input
                type="checkbox"
                :checked="selectedTrackIds.includes(item.id)"
                class="w-4 h-4 rounded border-muted-foreground/30 accent-primary cursor-pointer"
                @change="toggleSelect(item.id)"
              />
            </TableCell>

            <TableCell class="align-middle font-mono text-xs text-muted-foreground">
              <TrackPlayingMarker
                :list-index="index"
                :track-id="item.id"
                :now-playing-track-id="nowPlayingTrackId"
                :player-is-playing="playerIsPlaying"
                :toggle-play="togglePlayerPlay"
              />
            </TableCell>

            <TableCell class="p-2">
              <div class="w-10 h-10 mx-auto rounded overflow-hidden border relative bg-secondary flex items-center justify-center pointer-events-none">
                <Disc class="absolute w-5 h-5 opacity-20 z-0" />
                <SafeImage
                  v-if="item.custom_cover_type || item.albumCoverType"
                  :src="getTrackImageUrl(item.id)"
                  type="track"
                  class="relative z-10 w-full h-full object-cover"
                />
              </div>
            </TableCell>

            <TableCell class="max-w-0 text-left">
              <button
                type="button"
                class="truncate text-sm font-semibold hover:underline hover:text-primary block w-full text-left"
                :class="activeNow(item.id) ? 'text-primary' : ''"
                :title="item.title"
                @click.stop="goToTrack(item.id)"
              >
                {{ splitTrackTitle(item.title).main }}
                <span v-if="splitTrackTitle(item.title).suffix" class="text-muted-foreground/75 text-xs font-normal">
                  {{ ' ' + splitTrackTitle(item.title).suffix }}
                </span>
              </button>
            </TableCell>

            <TableCell class="max-w-0 text-left">
              <p
                class="truncate text-sm text-muted-foreground"
                :title="artistLabel(item.artist)"
              >
                <template v-for="(artistName, aIdx) in getArtistList(item.artist)" :key="aIdx">
                  <button
                    type="button"
                    class="hover:underline hover:text-primary"
                    @click.stop="goToArtist(artistName)"
                  >{{ artistName }}</button>
                  <span v-if="aIdx < getArtistList(item.artist).length - 1">, </span>
                </template>
              </p>
            </TableCell>

            <TableCell class="max-w-0 text-left">
              <button
                type="button"
                class="truncate text-sm text-muted-foreground hover:underline hover:text-primary block w-full text-left"
                :title="item.albumName || t('common.unknownAlbum')"
                @click.stop="goToAlbum(item.albumId)"
              >
                {{ item.albumName || t('common.unknownAlbum') }}
              </button>
            </TableCell>

            <TableCell class="text-center shrink-0 whitespace-nowrap" @click.stop>
              <Popover>
                <PopoverTrigger as-child>
                  <button type="button" class="text-yellow-500 text-sm tracking-widest hover:scale-105 transition-transform focus:outline-none">
                    {{ renderStars(item.rating) }}
                  </button>
                </PopoverTrigger>
                <PopoverContent class="w-auto p-2" align="center">
                  <div class="flex gap-1">
                    <button
                      v-for="star in 5"
                      :key="star"
                      type="button"
                      class="text-2xl hover:scale-125 transition-transform focus:outline-none"
                      :class="star <= (item.rating || 0) ? 'text-yellow-500' : 'text-muted'"
                      @click="updateRating(item, star)"
                    >★</button>
                  </div>
                </PopoverContent>
              </Popover>
              <button type="button" class="ml-2 align-middle focus:outline-none" @click.stop="toggleStar(item)">
                <Heart class="w-3.5 h-3.5 inline" :class="item.starred ? 'text-red-500 fill-red-500' : 'text-muted-foreground'" />
              </button>
            </TableCell>

            <TableCell class="text-center font-bold text-primary tabular-nums text-sm shrink-0 whitespace-nowrap">{{ item.play_count || 0 }}</TableCell>

            <TableCell class="text-center text-xs text-muted-foreground tabular-nums shrink-0 max-w-0">
              <span class="block truncate" :title="formatScannedAt(item.scanned_at)">
                {{ formatScannedAt(item.scanned_at) }}
              </span>
            </TableCell>

            <TableCell class="text-right">
              <Button
                variant="ghost"
                size="icon"
                class="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                @click.stop="openFromTrigger($event, item)"
              >
                <MoreVertical class="w-4 h-4" />
              </Button>
            </TableCell>
          </TableRow>
        </tbody>
      </Table>
    </div>

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
      :fetch-metadata="fetchMetadata"
    />

    <Transition name="slide-up">
      <div
        v-if="selectedTrackIds.length > 0"
        class="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-[60] flex items-center bg-foreground text-background px-6 py-3 rounded-full gap-5 font-sans"
      >
        <div class="flex items-center gap-2">
          <span class="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground font-black text-xs">{{ selectedTrackIds.length }}</span>
          <span class="font-bold text-sm whitespace-nowrap">{{ t('trackTable.tracksSelected') }}</span>
        </div>
        <div class="w-px h-5 bg-background/20" />
        <button type="button" class="text-sm font-bold flex items-center gap-2 hover:text-primary transition-colors whitespace-nowrap" @click="openPlaylistModal()">
          <ListMusic class="w-4 h-4" /> {{ t('trackTable.addToPlaylistBulk') }}
        </button>
        <button type="button" class="ml-2 text-muted-foreground hover:text-background p-1 transition-colors" :title="t('trackTable.clearSelection')" @click="clearSelection">
          <X class="w-5 h-5" />
        </button>
      </div>
    </Transition>

    <PlaylistSelectModal v-model:is-open="isPlaylistModalOpen" :track-ids="tracksToAddToPlaylist" @success="onPlaylistAddSuccess" />
  </div>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translate(-50%, 20px) scale(0.95);
}
</style>
