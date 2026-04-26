<script setup>
import { computed } from 'vue'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Heart, Play, MoreVertical, Disc, Users, ListMusic, Sparkles, Trash2, GripVertical } from 'lucide-vue-next'
import { VueDraggable } from 'vue-draggable-plus'
import SafeImage from '@/components/shared/SafeImage.vue'

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
  fetchMetadata: { type: Function, required: true }
})

const emit = defineEmits(['update:localTracks'])

const draggableTracks = computed({
  get: () => props.localTracks,
  set: (val) => emit('update:localTracks', val)
})
</script>

<template>
  <div class="md:hidden flex flex-col pb-24">
    <div v-if="selectable && draggableTracks.length > 0" class="flex items-center px-4 py-3 border-b bg-muted/10 gap-3">
      <input type="checkbox" :checked="isAllSelected" :indeterminate="isSomeSelected" @change="toggleSelectAll" class="w-5 h-5 rounded border-muted-foreground/30 accent-primary"/>
      <span class="text-sm font-bold">전체 선택</span>
    </div>

    <VueDraggable
      v-model="draggableTracks"
      class="flex flex-col"
      handle=".drag-handle"
      :disabled="!playlistId"
      :animation="150"
      @end="onDragEnd"
    >
      <div v-for="(item, index) in draggableTracks" :key="`mob-${item.id}`" class="flex items-center gap-3 p-3 border-b border-border/50 hover:bg-muted/30 active:bg-muted/50 transition-colors bg-background" :class="{'bg-primary/5': selectedTrackIds.includes(item.id)}" @click="playTrack(index)">
        <div v-if="playlistId" class="shrink-0 flex items-center pr-1" @click.stop>
          <GripVertical class="w-5 h-5 text-muted-foreground/30 hover:text-foreground cursor-grab active:cursor-grabbing drag-handle transition-colors" />
        </div>

        <div v-if="selectable" class="shrink-0 pl-1" @click.stop>
          <input type="checkbox" :checked="selectedTrackIds.includes(item.id)" @change="toggleSelect(item.id)" class="w-5 h-5 rounded border-muted-foreground/30 accent-primary"/>
        </div>

        <div v-if="showCover" class="relative w-14 h-14 rounded-md overflow-hidden shrink-0 shadow-sm border bg-secondary flex items-center justify-center pointer-events-none">
          <Disc class="absolute w-6 h-6 opacity-20 z-0" />
          <SafeImage v-if="item.custom_cover_type || item.albumCoverType" :src="getTrackImageUrl(item.id)" type="track" class="relative z-10 w-full h-full object-cover"/>
          <div class="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity z-20"><Play class="w-6 h-6 text-white fill-current" /></div>
        </div>

        <div class="flex flex-col min-w-0 flex-1 gap-0.5">
          <div class="flex items-start justify-between gap-2">
            <span class="font-bold text-sm truncate">{{ item.title }}</span>
            <div class="flex items-center gap-1 shrink-0 -mr-1">
              <button @click.stop="toggleStar(item)" class="p-1 focus:outline-none"><Heart class="w-4 h-4" :class="item.starred ? 'text-red-500 fill-current' : 'text-muted-foreground'" /></button>
              <DropdownMenu>
                <DropdownMenuTrigger as-child><button class="p-1 text-muted-foreground focus:outline-none" @click.stop><MoreVertical class="w-4 h-4" /></button></DropdownMenuTrigger>
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
                  <DropdownMenuItem @click.stop="fetchMetadata(item.id)"><Sparkles class="mr-2 h-4 w-4 text-yellow-500" /> 메타데이터 업데이트</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
              <span @click.stop="goToAlbum(item.albumId)" class="hover:underline cursor-pointer">{{ item.albumName || 'Unknown Album' }}</span>
            </template>
          </div>

          <div class="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-muted-foreground/80">
            <div @click.stop>
              <Popover>
                <PopoverTrigger as-child><button class="text-yellow-500 tracking-wider font-sans focus:outline-none">{{ renderStars(item.rating) }}</button></PopoverTrigger>
                <PopoverContent class="w-auto p-2" align="start" side="top">
                  <div class="flex gap-2">
                    <button v-for="star in 5" :key="star" @click="updateRating(item, star)" class="text-2xl focus:outline-none" :class="star <= (item.rating || 0) ? 'text-yellow-500' : 'text-muted'">★</button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <span class="text-primary/70 font-bold">{{ item.play_count || 0 }}회</span>
            <span>{{ formatTrackTime(item.duration) }}</span>
          </div>
        </div>
      </div>
    </VueDraggable>
  </div>
</template>
