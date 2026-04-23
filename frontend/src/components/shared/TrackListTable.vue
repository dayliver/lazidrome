<script setup>
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { useAuthStore } from '@/stores/auth'
import { useEnrichmentStore } from '@/stores/enrichment'
import { usePlaylistStore } from '@/stores/playlist'

import { formatTrackTime } from '@/lib/audio'
import { getCoverUrl } from '@/lib/image'

import { Table, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
// 💡 드래그 핸들용 GripVertical 아이콘 임포트
import { Heart, Play, MoreVertical, Star, Disc, Users, ListPlus, ListMusic, Sparkles, X, Trash2, GripVertical } from 'lucide-vue-next'
import SafeImage from '@/components/ui/SafeImage.vue'
import PlaylistSelectModal from './PlaylistSelectModal.vue'

// 💡 vue-draggable-plus 임포트
import { VueDraggable } from 'vue-draggable-plus'

const props = defineProps({
  tracks: { type: Array, required: true, default: () => [] },
  showCover: { type: Boolean, default: true },
  showArtist: { type: Boolean, default: true },
  showAlbum: { type: Boolean, default: true },
  selectable: { type: Boolean, default: true },
  playlistId: { type: String, default: null } 
})

const router = useRouter()
const library = useLibraryStore()
const player = usePlayerStore()
const auth = useAuthStore()
const enrichment = useEnrichmentStore()
const playlistStore = usePlaylistStore()

// ============================================================================
// 💡 [신규] 드래그 앤 드롭을 위한 로컬 상태 동기화
// ============================================================================
const localTracks = ref([])

// 부모에게서 온 데이터를 로컬로 복사 (삭제나 추가가 발생하면 자동 동기화)
watch(() => props.tracks, (newVal) => {
  localTracks.value = [...newVal]
}, { immediate: true })

// 드래그가 끝났을 때 순서 저장 API 호출
const onDragEnd = async () => {
  if (!props.playlistId) return
  
  // 현재 localTracks의 순서대로 position을 10 단위로 재부여하여 객체 배열 생성
  const reorderedItems = localTracks.value.map((track, index) => ({
    playlistTrackId: track.playlist_track_id,
    position: (index + 1) * 10
  }))

  await playlistStore.reorderTracks(props.playlistId, reorderedItems)
}
// ============================================================================

const selectedTrackIds = ref([])
const isPlaylistModalOpen = ref(false)
const tracksToAddToPlaylist = ref([])

// 전체 선택 감지는 localTracks 기준으로 변경
const isAllSelected = computed(() => localTracks.value.length > 0 && selectedTrackIds.value.length === localTracks.value.length)
const isSomeSelected = computed(() => selectedTrackIds.value.length > 0 && selectedTrackIds.value.length < localTracks.value.length)

const toggleSelectAll = () => {
  if (isAllSelected.value) selectedTrackIds.value = []
  else selectedTrackIds.value = localTracks.value.map(t => t.id)
}

const toggleSelect = (id) => {
  const idx = selectedTrackIds.value.indexOf(id)
  if (idx > -1) selectedTrackIds.value.splice(idx, 1)
  else selectedTrackIds.value.push(id)
}

const openPlaylistModal = (trackId = null) => {
  if (trackId) tracksToAddToPlaylist.value = [trackId]
  else tracksToAddToPlaylist.value = [...selectedTrackIds.value]
  isPlaylistModalOpen.value = true
}

const onPlaylistAddSuccess = () => selectedTrackIds.value = []

const getTrackImageUrl = (id) => getCoverUrl(auth.serverUrl, 'track', id, auth.token)

const playTrack = (index) => {
  if (player.playList) player.playList(localTracks.value, index)
  else player.playNewQueue(localTracks.value, index) 
}

const goToArtist = async (artistName) => {
  if (!artistName || artistName === 'Unknown Artist') return
  const allArtists = await library.getArtists()
  const targetArtist = allArtists.find(a => a.name === artistName)
  if (targetArtist) router.push({ name: 'artist-detail', params: { id: targetArtist.id } })
}

const goToAlbum = (albumId) => {
  if (!albumId) return
  router.push({ name: 'album-detail', params: { id: albumId } })
}

const toggleStar = async (track) => {
  const newStatus = !track.starred
  track.starred = newStatus 
  await library.toggleTrackStar(track.id, newStatus, auth)
}

const updateRating = async (track, rating) => {
  track.rating = rating 
  await library.updateTrackRating(track.id, rating, auth)
}

const fetchMetadata = (trackId) => {
  if (!trackId) return
  enrichment.fetchPreview('track', trackId)
}

const getArtistList = (artistString) => {
  if (!artistString) return ['Unknown Artist']
  return artistString.split(', ')
}

const renderStars = (rating) => '★'.repeat(rating || 0) + '☆'.repeat(5 - (rating || 0))

const removeTrackFromPlaylist = async (playlistTrackId, trackTitle) => {
  if (!props.playlistId || !playlistTrackId) return
  if (confirm(`'${trackTitle}' 곡을 이 플레이리스트에서 제외하시겠습니까?`)) {
    await playlistStore.removeTrack(props.playlistId, playlistTrackId)
  }
}

const removeSelectedFromPlaylist = async () => {
  if (!props.playlistId) return
  if (confirm(`선택한 ${selectedTrackIds.value.length}곡을 플레이리스트에서 일괄 제외하시겠습니까?`)) {
    const tracksToRemove = localTracks.value.filter(t => selectedTrackIds.value.includes(t.id) && t.playlist_track_id)
    await Promise.all(tracksToRemove.map(t => playlistStore.removeTrack(props.playlistId, t.playlist_track_id)))
    selectedTrackIds.value = []
  }
}
</script>

<template>
  <div class="w-full relative">
    
    <div class="hidden md:block pb-20"> 
      <Table>
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
          v-model="localTracks"
          tag="tbody"
          class="[&_tr:last-child]:border-0"
          handle=".drag-handle"
          :disabled="!playlistId"
          :animation="150"
          @end="onDragEnd"
        >
          <TableRow 
            v-for="(item, index) in localTracks" 
            :key="item.id"
            class="hover:bg-muted/50 transition-colors group cursor-pointer"
            :class="{'bg-primary/5': selectedTrackIds.includes(item.id)}"
            @click="playTrack(index)"
          >
            <TableCell v-if="playlistId" class="w-8 p-0 text-center align-middle" @click.stop>
              <GripVertical class="w-4 h-4 mx-auto text-muted-foreground/30 hover:text-foreground cursor-grab active:cursor-grabbing drag-handle transition-colors" />
            </TableCell>

            <TableCell v-if="selectable" class="text-center" @click.stop>
              <input type="checkbox" :checked="selectedTrackIds.includes(item.id)" @change="toggleSelect(item.id)" class="w-4 h-4 rounded border-muted-foreground/30 accent-primary cursor-pointer focus:ring-primary focus:ring-offset-2 transition-all"/>
            </TableCell>

            <TableCell class="text-center text-muted-foreground font-mono text-xs">
              <div class="w-5 h-5 mx-auto flex items-center justify-center">
                <span class="group-hover:hidden">{{ index + 1 }}</span>
                <Play class="hidden group-hover:block w-4 h-4 text-primary fill-current" />
              </div>
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
                  <span class="font-bold text-base truncate">{{ item.title }}</span>
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

    <div class="md:hidden flex flex-col pb-24">
      <div v-if="selectable && localTracks.length > 0" class="flex items-center px-4 py-3 border-b bg-muted/10 gap-3">
        <input type="checkbox" :checked="isAllSelected" :indeterminate="isSomeSelected" @change="toggleSelectAll" class="w-5 h-5 rounded border-muted-foreground/30 accent-primary"/>
        <span class="text-sm font-bold">전체 선택</span>
      </div>

      <VueDraggable
        v-model="localTracks"
        class="flex flex-col"
        handle=".drag-handle"
        :disabled="!playlistId"
        :animation="150"
        @end="onDragEnd"
      >
        <div v-for="(item, index) in localTracks" :key="`mob-${item.id}`" class="flex items-center gap-3 p-3 border-b border-border/50 hover:bg-muted/30 active:bg-muted/50 transition-colors bg-background" :class="{'bg-primary/5': selectedTrackIds.includes(item.id)}" @click="playTrack(index)">
          
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

    <Transition name="slide-up">
      <div v-if="selectedTrackIds.length > 0" class="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-[60] flex items-center bg-foreground text-background px-6 py-3 rounded-full shadow-2xl gap-5 font-sans">
        <div class="flex items-center gap-2">
          <span class="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground font-black text-xs">{{ selectedTrackIds.length }}</span>
          <span class="font-bold text-sm whitespace-nowrap">곡 선택됨</span>
        </div>
        <div class="w-px h-5 bg-background/20"></div>
        <button @click="openPlaylistModal()" class="text-sm font-bold flex items-center gap-2 hover:text-primary transition-colors whitespace-nowrap"><ListMusic class="w-4 h-4" /> 플레이리스트에 추가</button>
        <template v-if="playlistId">
          <div class="w-px h-5 bg-background/20"></div>
          <button @click="removeSelectedFromPlaylist" class="text-sm font-bold flex items-center gap-2 text-red-400 hover:text-red-500 transition-colors whitespace-nowrap"><Trash2 class="w-4 h-4" /> 제외하기</button>
        </template>
        <button @click="selectedTrackIds = []" class="ml-2 text-muted-foreground hover:text-background p-1 focus:outline-none transition-colors" title="선택 취소"><X class="w-5 h-5" /></button>
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