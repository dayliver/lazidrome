<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Table, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { MoreVertical, Disc, GripVertical } from 'lucide-vue-next'
import { VueDraggable } from 'vue-draggable-plus'
import SafeImage from '@/components/shared/SafeImage.vue'
import TrackPlayingMarker from '@/components/shared/TrackPlayingMarker.vue'
import FavoriteButton from '@/components/shared/FavoriteButton.vue'
import StarRating from '@/components/shared/StarRating.vue'

const props = defineProps({
  localTracks: { type: Array, required: true },
  selectedTrackIds: { type: Array, required: true },
  showCover: { type: Boolean, required: true },
  showArtist: { type: Boolean, required: true },
  showAlbum: { type: Boolean, required: true },
  selectable: { type: Boolean, required: true },
  playlistId: { type: String, default: null },
  isAllSelected: { type: Boolean, required: true },
  isSomeSelected: { type: Boolean, required: true },
  toggleSelectAll: { type: Function, required: true },
  toggleSelect: { type: Function, required: true },
  playTrack: { type: Function, required: true },
  prefetchTrackStream: { type: Function, default: null },
  onDragEnd: { type: Function, required: true },
  getTrackImageUrl: { type: Function, required: true },
  toggleStar: { type: Function, required: true },
  getArtistList: { type: Function, required: true },
  goToArtist: { type: Function, required: true },
  goToAlbum: { type: Function, required: true },
  goToTrack: { type: Function, required: true },
  formatTrackTime: { type: Function, required: true },
  updateRating: { type: Function, required: true },
  removeTrackFromPlaylist: { type: Function, required: true },
  openPlaylistModal: { type: Function, required: true },
  fetchMetadata: { type: Function, required: true },
  nowPlayingTrackId: { type: String, default: null },
  playerIsPlaying: { type: Boolean, default: false },
  togglePlay: { type: Function, required: true },
  openContextAt: { type: Function, required: true },
  openContextFromTrigger: { type: Function, required: true },
})

function activeNow(trackId) {
  return props.nowPlayingTrackId != null && String(props.nowPlayingTrackId) === String(trackId)
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

const emit = defineEmits(['update:localTracks'])
const { t } = useI18n()

const draggableTracks = computed({
  get: () => props.localTracks,
  set: (val) => emit('update:localTracks', val),
})
</script>

<template>
  <div class="hidden md:block pb-2">
    <Table class="border-b">
      <TableHeader>
        <TableRow class="bg-muted/30">
          <TableHead v-if="playlistId" class="w-8"></TableHead>
          <TableHead v-if="selectable" class="w-10 px-0 text-center">
            <!-- label이 칸 전체를 덮어, 체크박스를 정확히 맞히지 않아도 토글된다 -->
            <label class="flex h-10 cursor-pointer items-center justify-center px-2">
              <input type="checkbox" :checked="isAllSelected" :indeterminate="isSomeSelected" @change="toggleSelectAll" class="w-4 h-4 rounded border-muted-foreground/30 accent-primary cursor-pointer focus:ring-primary focus:ring-offset-2 transition-all"/>
            </label>
          </TableHead>
          <TableHead class="w-[50px] text-center">#</TableHead>
          <TableHead v-if="showCover" class="w-16 text-center">{{ t('trackTable.cover') }}</TableHead>
          <TableHead>{{ t('trackTable.trackInfo') }}</TableHead>
          <TableHead class="w-24 text-center">{{ t('trackTable.duration') }}</TableHead>
          <TableHead class="w-24 text-center">{{ t('trackTable.year') }}</TableHead>
          <TableHead class="w-32 text-center">{{ t('trackTable.rating') }}</TableHead>
          <TableHead class="w-24 text-center">{{ t('trackTable.playCount') }}</TableHead>
          <TableHead class="w-16"></TableHead>
        </TableRow>
      </TableHeader>

      <VueDraggable
        v-model="draggableTracks"
        tag="tbody"
        class="[&_tr:last-child]:border-0"
        handle=".drag-handle"
        :disabled="!playlistId"
        :animation="150"
        @end="onDragEnd"
      >
        <TableRow
          v-for="(item, index) in draggableTracks"
          :key="item.id"
          class="hover:bg-muted/50 transition-colors group cursor-pointer"
          :class="{
            'bg-primary/5': selectedTrackIds.includes(item.id),
            'bg-primary/[0.08]': activeNow(item.id),
          }"
          @click="playTrack(index)"
          @contextmenu.prevent="openContextAt($event, item)"
          @mouseenter="prefetchTrackStream?.(item)"
        >
          <TableCell v-if="playlistId" class="w-8 p-0 text-center align-middle" @click.stop>
            <GripVertical class="w-4 h-4 mx-auto text-muted-foreground/30 hover:text-foreground cursor-grab active:cursor-grabbing drag-handle transition-colors" />
          </TableCell>

          <TableCell v-if="selectable" class="p-0 text-center" @click.stop>
            <!-- label이 셀 전체를 덮어, 체크박스를 정확히 맞히지 않아도 토글된다 -->
            <label class="flex cursor-pointer items-center justify-center p-2">
              <input type="checkbox" :checked="selectedTrackIds.includes(item.id)" @change="toggleSelect(item.id)" class="w-4 h-4 rounded border-muted-foreground/30 accent-primary cursor-pointer focus:ring-primary focus:ring-offset-2 transition-all"/>
            </label>
          </TableCell>

          <TableCell class="align-middle font-mono text-xs text-muted-foreground">
            <TrackPlayingMarker
              :list-index="index"
              :track-id="item.id"
              :now-playing-track-id="nowPlayingTrackId"
              :player-is-playing="playerIsPlaying"
              :toggle-play="togglePlay"
            />
          </TableCell>

          <TableCell v-if="showCover" class="p-2">
            <div class="w-10 h-10 mx-auto rounded overflow-hidden border shadow-sm relative bg-secondary flex items-center justify-center pointer-events-none">
              <Disc class="absolute w-5 h-5 opacity-20 z-0" />
              <SafeImage v-if="item.custom_cover_type || item.albumCoverType" :src="getTrackImageUrl(item.id)" type="track" class="relative z-10 w-full h-full object-cover"/>
            </div>
          </TableCell>

          <TableCell>
            <div class="flex flex-col min-w-0">
              <div class="flex items-center gap-2">
                <span class="truncate text-sm font-semibold hover:underline hover:text-primary" :class="activeNow(item.id) ? 'text-primary' : ''" @click.stop="goToTrack(item.id)">
                  {{ splitTrackTitle(item.title).main }}
                  <span v-if="splitTrackTitle(item.title).suffix" class="ml-1 text-xs text-muted-foreground/75">
                    {{ ' ' + splitTrackTitle(item.title).suffix }}
                  </span>
                </span>
                <FavoriteButton :starred="!!item.starred" size="sm" @click.stop @toggle="toggleStar(item)" />
              </div>
              <div class="text-xs font-medium text-muted-foreground truncate mt-0.5">
                <template v-if="showArtist">
                  <template v-for="(artistName, aIdx) in getArtistList(item.artist)" :key="aIdx">
                    <span class="hover:underline hover:text-primary cursor-pointer" @click.stop="goToArtist(artistName)">{{ artistName }}</span>
                    <span v-if="aIdx < getArtistList(item.artist).length - 1" class="mr-1">,</span>
                  </template>
                </template>
                <span v-if="showArtist && showAlbum" class="mx-1.5">•</span>
                <template v-if="showAlbum">
                  <span class="hover:underline hover:text-primary cursor-pointer" @click.stop="goToAlbum(item.albumId)">{{ item.albumName || t('common.unknownAlbum') }}</span>
                </template>
              </div>
            </div>
          </TableCell>

          <TableCell class="text-center text-sm font-medium text-muted-foreground tabular-nums">{{ formatTrackTime(item.duration) }}</TableCell>
          <TableCell class="text-center text-sm text-muted-foreground">{{ item.year || '-' }}</TableCell>

          <TableCell class="text-center" @click.stop>
            <Popover>
              <PopoverTrigger as-child>
                <button class="hover:scale-105 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md" :aria-label="t('trackTable.rating')">
                  <StarRating :rating="item.rating || 0" size="sm" />
                </button>
              </PopoverTrigger>
              <PopoverContent class="w-auto p-2" align="center">
                <StarRating :rating="item.rating || 0" interactive size="lg" @change="updateRating(item, $event)" />
              </PopoverContent>
            </Popover>
          </TableCell>

          <TableCell class="text-center font-bold text-primary tabular-nums">{{ item.play_count || 0 }}</TableCell>

          <TableCell class="text-right">
            <Button
              variant="ghost"
              size="icon"
              class="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none"
              @click.stop="openContextFromTrigger($event, item)"
            >
              <MoreVertical class="w-4 h-4" />
            </Button>
          </TableCell>
        </TableRow>
      </VueDraggable>
    </Table>
  </div>
</template>
