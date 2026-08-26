<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Play, MoreVertical, Disc, Users, GripVertical } from 'lucide-vue-next'
import { VueDraggable } from 'vue-draggable-plus'
import SafeImage from '@/components/shared/SafeImage.vue'
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

const draggableTracks = computed({
  get: () => props.localTracks,
  set: (val) => emit('update:localTracks', val)
})
const { t } = useI18n()

const LONG_PRESS_MS = 500
let longPressTimer = null
let longPressOpened = false

function clearLongPress() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

function onRowTouchStart(event, item) {
  clearLongPress()
  longPressOpened = false
  const touch = event.touches?.[0]
  if (!touch) return
  longPressTimer = setTimeout(() => {
    longPressOpened = true
    props.openContextAt(event, item)
  }, LONG_PRESS_MS)
}

function onRowTouchEnd() {
  clearLongPress()
}

function onRowClick(index, event) {
  if (longPressOpened) {
    longPressOpened = false
    event?.preventDefault?.()
    return
  }
  props.playTrack(index)
}
</script>

<template>
  <div class="md:hidden flex flex-col pb-24">
    <div v-if="selectable && draggableTracks.length > 0" class="flex items-center px-4 py-3 border-b bg-muted/10 gap-3">
      <input type="checkbox" :checked="isAllSelected" :indeterminate="isSomeSelected" @change="toggleSelectAll" class="w-5 h-5 rounded border-muted-foreground/30 accent-primary"/>
      <span class="text-sm font-bold">{{ t('trackTable.selectAll') }}</span>
    </div>

    <VueDraggable
      v-model="draggableTracks"
      class="flex flex-col"
      handle=".drag-handle"
      :disabled="!playlistId"
      :animation="150"
      @end="onDragEnd"
    >
      <div v-for="(item, index) in draggableTracks" :key="`mob-${item.id}`" class="flex items-center gap-3 border-b border-border/50 bg-background p-3 transition-colors hover:bg-muted/30 active:bg-muted/50" :class="{
          'border-l-[3px] border-l-primary': activeNow(item.id),
          'bg-primary/[0.07]': activeNow(item.id),
          'bg-primary/5': selectedTrackIds.includes(item.id) && !activeNow(item.id),
        }" @click="onRowClick(index, $event)" @touchstart.passive="onRowTouchStart($event, item)" @touchend="onRowTouchEnd" @touchmove="onRowTouchEnd" @touchcancel="onRowTouchEnd" @mouseenter="prefetchTrackStream?.(item)"
      >
        <div v-if="playlistId" class="shrink-0 flex items-center pr-1" @click.stop>
          <GripVertical class="w-5 h-5 text-muted-foreground/30 hover:text-foreground cursor-grab active:cursor-grabbing drag-handle transition-colors" />
        </div>

        <div v-if="selectable" class="shrink-0" @click.stop>
          <!-- label이 터치 영역을 넓혀준다 — 체크박스만 정확히 누르지 않아도 된다 -->
          <label class="flex cursor-pointer items-center justify-center py-3 pl-2 pr-2">
            <input type="checkbox" :checked="selectedTrackIds.includes(item.id)" @change="toggleSelect(item.id)" class="w-5 h-5 rounded border-muted-foreground/30 accent-primary"/>
          </label>
        </div>

        <div v-if="showCover" class="relative w-14 h-14 rounded-md overflow-hidden shrink-0 shadow-sm border bg-secondary flex items-center justify-center pointer-events-none">
          <Disc class="absolute w-6 h-6 opacity-20 z-0" />
          <SafeImage v-if="item.custom_cover_type || item.albumCoverType" :src="getTrackImageUrl(item.id)" type="track" class="relative z-10 w-full h-full object-cover"/>
          <div class="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity z-20"><Play class="w-6 h-6 text-white fill-current" /></div>
        </div>

        <div class="flex flex-col min-w-0 flex-1 gap-0.5">
          <div class="flex items-start justify-between gap-2">
            <div class="flex min-w-0 flex-1 items-center gap-1.5">
              <span class="truncate text-[12px] font-semibold hover:underline" :class="activeNow(item.id) ? 'text-primary' : ''" @click.stop="goToTrack(item.id)">
                {{ splitTrackTitle(item.title).main }}
                <span v-if="splitTrackTitle(item.title).suffix" class="ml-1 text-[10px] text-muted-foreground/75">
                  {{ ' ' + splitTrackTitle(item.title).suffix }}
                </span>
              </span>
              <div
                v-if="activeNow(item.id)"
                class="playing-badge-mobile"
                :class="playerIsPlaying ? 'playing-badge-mobile--on' : 'playing-badge-mobile--paused'"
                aria-hidden="true"
              >
                <span class="playing-badge-mobile-bar" />
                <span class="playing-badge-mobile-bar playing-badge-mobile-bar-d1" />
                <span class="playing-badge-mobile-bar playing-badge-mobile-bar-d2" />
              </div>
            </div>
            <div class="flex items-center gap-1 shrink-0 -mr-1">
              <FavoriteButton :starred="!!item.starred" size="sm" @click.stop @toggle="toggleStar(item)" />
              <button class="p-1 text-muted-foreground focus:outline-none" @click.stop="openContextFromTrigger($event, item)">
                <MoreVertical class="w-4 h-4" />
              </button>
            </div>
          </div>

          <div class="text-[11px] font-medium text-muted-foreground truncate">
            <template v-if="showArtist">
              <template v-for="(artistName, aIdx) in getArtistList(item.artist)" :key="aIdx">
                <span @click.stop="goToArtist(artistName)" class="hover:underline cursor-pointer">{{ artistName }}</span>
                <span v-if="aIdx < getArtistList(item.artist).length - 1" class="mr-1">,</span>
              </template>
            </template>
            <span v-if="showArtist && showAlbum" class="mx-1">•</span>
            <template v-if="showAlbum">
              <span @click.stop="goToAlbum(item.albumId)" class="hover:underline cursor-pointer">{{ item.albumName || t('common.unknownAlbum') }}</span>
            </template>
          </div>

          <div class="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-muted-foreground/80">
            <div @click.stop>
              <Popover>
                <PopoverTrigger as-child>
                  <button class="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md" :aria-label="t('trackTable.rating')">
                    <StarRating :rating="item.rating || 0" size="sm" class="[&_span]:p-0" />
                  </button>
                </PopoverTrigger>
                <PopoverContent class="w-auto p-2" align="start" side="top">
                  <StarRating :rating="item.rating || 0" interactive size="lg" @change="updateRating(item, $event)" />
                </PopoverContent>
              </Popover>
            </div>
            <span class="text-primary/70 font-bold">{{ t('common.plays', { count: item.play_count || 0 }) }}</span>
            <span>{{ formatTrackTime(item.duration) }}</span>
          </div>
        </div>
      </div>
    </VueDraggable>
  </div>
</template>

<style scoped>
.playing-badge-mobile {
  display: inline-flex;
  align-items: flex-end;
  justify-content: center;
  gap: 2px;
  width: 16px;
  height: 16px;
  padding: 2px;
  border-radius: 4px;
  background: oklch(var(--primary) / 0.18);
  box-shadow: inset 0 0 0 1px oklch(var(--primary) / 0.35);
}
.playing-badge-mobile-bar {
  display: inline-block;
  width: 2px;
  height: 5px;
  border-radius: 2px;
  background: oklch(var(--primary));
  align-self: flex-end;
}
.playing-badge-mobile--on .playing-badge-mobile-bar {
  animation: eq-mobile 1s ease-in-out infinite;
}
.playing-badge-mobile-bar-d1 { animation-delay: 0.2s; }
.playing-badge-mobile-bar-d2 { animation-delay: 0.4s; }
.playing-badge-mobile--paused .playing-badge-mobile-bar {
  animation: none;
}
.playing-badge-mobile--paused .playing-badge-mobile-bar:nth-child(1) { height: 4px; }
.playing-badge-mobile--paused .playing-badge-mobile-bar:nth-child(2) { height: 8px; }
.playing-badge-mobile--paused .playing-badge-mobile-bar:nth-child(3) { height: 5px; }

@keyframes eq-mobile {
  0%, 100% { height: 3px; }
  50% { height: 9px; }
}
</style>
