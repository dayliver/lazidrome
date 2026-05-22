<script setup>
import { computed } from 'vue'
import { Table, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Heart, MoreVertical, Disc, Users, ListPlus, ListMusic, Sparkles, Trash2, GripVertical } from 'lucide-vue-next'
import { VueDraggable } from 'vue-draggable-plus'
import SafeImage from '@/components/shared/SafeImage.vue'
import TrackPlayingMarker from '@/components/shared/TrackPlayingMarker.vue'

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
  formatTrackTime: { type: Function, required: true },
  renderStars: { type: Function, required: true },
  updateRating: { type: Function, required: true },
  removeTrackFromPlaylist: { type: Function, required: true },
  openPlaylistModal: { type: Function, required: true },
  fetchMetadata: { type: Function, required: true },
  /** 플레이어 now playing 과 동일 표시용 (null 이면 미표시) */
  nowPlayingTrackId: { type: String, default: null },
  playerIsPlaying: { type: Boolean, default: false },
  togglePlay: { type: Function, required: true }
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

const draggableTracks = computed({
  get: () => props.localTracks,
  set: (val) => emit('update:localTracks', val)
})
</script>

<template>
  <div class="hidden md:block pb-2">
    <Table class="border-b">
      <TableHeader>
        <TableRow class="bg-muted/30">
          <TableHead v-if="playlistId" class="w-8"></TableHead>
          <TableHead v-if="selectable" class="w-10 text-center">
            <input type="checkbox" :checked="isAllSelected" :indeterminate="isSomeSelected" @change="toggleSelectAll" class="w-4 h-4 rounded border-muted-foreground/30 accent-primary cursor-pointer focus:ring-primary focus:ring-offset-2 transition-all"/>
          </TableHead>
          <TableHead class="w-[50px] text-center">#</TableHead>
          <TableHead v-if="showCover" class="w-16 text-center">커버</TableHead>
          <TableHead>곡 정보</TableHead>
          <TableHead class="w-24 text-center">시간</TableHead>
          <TableHead class="w-24 text-center">연도</TableHead>
          <TableHead class="w-32 text-center">별점</TableHead>
          <TableHead class="w-24 text-center">재생 횟수</TableHead>
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
          @mouseenter="prefetchTrackStream?.(item)"
        >
          <TableCell v-if="playlistId" class="w-8 p-0 text-center align-middle" @click.stop>
            <GripVertical class="w-4 h-4 mx-auto text-muted-foreground/30 hover:text-foreground cursor-grab active:cursor-grabbing drag-handle transition-colors" />
          </TableCell>

          <TableCell v-if="selectable" class="text-center" @click.stop>
            <input type="checkbox" :checked="selectedTrackIds.includes(item.id)" @change="toggleSelect(item.id)" class="w-4 h-4 rounded border-muted-foreground/30 accent-primary cursor-pointer focus:ring-primary focus:ring-offset-2 transition-all"/>
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
                <span class="truncate text-[14px] font-semibold" :class="activeNow(item.id) ? 'text-primary' : ''">
                  {{ splitTrackTitle(item.title).main }}
                  <span v-if="splitTrackTitle(item.title).suffix" class="ml-1 text-[12px] text-muted-foreground/75">
                    {{ ' ' + splitTrackTitle(item.title).suffix }}
                  </span>
                </span>
                <button @click.stop="toggleStar(item)" class="hover:scale-110 transition-transform focus:outline-none">
                  <Heart class="w-4 h-4" :class="item.starred ? 'text-red-500 fill-current' : 'text-muted-foreground'" />
                </button>
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
                  <span class="hover:underline hover:text-primary cursor-pointer" @click.stop="goToAlbum(item.albumId)">{{ item.albumName || 'Unknown Album' }}</span>
                </template>
              </div>
            </div>
          </TableCell>

          <TableCell class="text-center text-sm font-medium text-muted-foreground tabular-nums">{{ formatTrackTime(item.duration) }}</TableCell>
          <TableCell class="text-center text-sm text-muted-foreground">{{ item.year || '-' }}</TableCell>

          <TableCell class="text-center" @click.stop>
            <Popover>
              <PopoverTrigger as-child>
                <button class="text-yellow-500 text-sm tracking-widest hover:scale-105 transition-transform focus:outline-none">{{ renderStars(item.rating) }}</button>
              </PopoverTrigger>
              <PopoverContent class="w-auto p-2" align="center">
                <div class="flex gap-1">
                  <button v-for="star in 5" :key="star" @click="updateRating(item, star)" class="text-2xl hover:scale-125 transition-transform focus:outline-none" :class="star <= (item.rating || 0) ? 'text-yellow-500' : 'text-muted'">★</button>
                </div>
              </PopoverContent>
            </Popover>
          </TableCell>

          <TableCell class="text-center font-bold text-primary tabular-nums">{{ item.play_count || 0 }}</TableCell>

          <TableCell class="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none" @click.stop><MoreVertical class="w-4 h-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" class="w-48">
                <template v-if="playlistId && item.playlist_track_id">
                  <DropdownMenuItem @click.stop="removeTrackFromPlaylist(item.playlist_track_id, item.title)" class="text-red-500 focus:text-red-500 focus:bg-red-500/10">
                    <Trash2 class="mr-2 h-4 w-4" /> 플레이리스트에서 제외
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </template>

                <DropdownMenuItem @click.stop="openPlaylistModal(item.id)"><ListMusic class="mr-2 h-4 w-4 text-primary" /> 플레이리스트에 추가...</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem v-if="showAlbum" @click.stop="goToAlbum(item.albumId)"><Disc class="mr-2 h-4 w-4" /> 앨범으로 이동</DropdownMenuItem>
                <DropdownMenuItem v-if="showArtist" @click.stop="goToArtist(item.artist)"><Users class="mr-2 h-4 w-4" /> 아티스트로 이동</DropdownMenuItem>
                <DropdownMenuItem @click.stop><ListPlus class="mr-2 h-4 w-4" /> 다음에 재생</DropdownMenuItem>
                <DropdownMenuItem @click.stop="fetchMetadata(item.id)"><Sparkles class="mr-2 h-4 w-4 text-yellow-500" /> 메타데이터 업데이트</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        </TableRow>
      </VueDraggable>
    </Table>
  </div>
</template>
