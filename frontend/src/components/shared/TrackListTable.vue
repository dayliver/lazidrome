<script setup>
import { useRouter } from 'vue-router'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { useAuthStore } from '@/stores/auth'
import { useEnrichmentStore } from '@/stores/enrichment'

import { formatTrackTime } from '@/lib/audio'
import { getCoverUrl } from '@/lib/image'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Heart, Play, MoreVertical, Star, Disc, Users, ListPlus, Sparkles } from 'lucide-vue-next'
import SafeImage from '@/components/ui/SafeImage.vue'

// 💉 1. Props 정의: 어느 페이지에서 쓰느냐에 따라 숨길 항목을 지정할 수 있습니다.
const props = defineProps({
  tracks: {
    type: Array,
    required: true,
    default: () => []
  },
  showCover: { type: Boolean, default: true },
  showArtist: { type: Boolean, default: true },
  showAlbum: { type: Boolean, default: true }
})

const router = useRouter()
const library = useLibraryStore()
const player = usePlayerStore()
const auth = useAuthStore()
const enrichment = useEnrichmentStore()

const getTrackImageUrl = (id) => getCoverUrl(auth.serverUrl, 'track', id, auth.token)

// 💉 2. 재생 시 현재 컴포넌트가 받은 props.tracks 배열을 기준으로 재생합니다.
const playTrack = (index) => {
  if (player.playList) {
    player.playList(props.tracks, index)
  } else {
    player.playNewQueue(props.tracks, index) 
  }
}

const goToArtist = async (artistName) => {
  if (!artistName || artistName === 'Unknown Artist') return
  const allArtists = await library.getArtists()
  const targetArtist = allArtists.find(a => a.name === artistName)
  if (targetArtist) {
    router.push({ name: 'artist-detail', params: { id: targetArtist.id } })
  } else {
    console.warn('해당 아티스트를 찾을 수 없습니다:', artistName)
  }
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

const renderStars = (rating) => {
  const r = rating || 0
  return '★'.repeat(r) + '☆'.repeat(5 - r)
}
</script>

<template>
  <div class="w-full">
    <div class="hidden md:block">
      <Table>
        <TableHeader>
          <TableRow class="bg-muted/30">
            <TableHead class="w-[60px] text-center">#</TableHead>
            <TableHead v-if="showCover" class="w-16 text-center">커버</TableHead>
            <TableHead>곡 정보</TableHead>
            <TableHead class="w-24 text-center">시간</TableHead>
            <TableHead class="w-24 text-center">연도</TableHead>
            <TableHead class="w-32 text-center">별점</TableHead>
            <TableHead class="w-24 text-center">재생 횟수</TableHead>
            <TableHead class="w-16"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow 
            v-for="(item, index) in tracks" 
            :key="item.id"
            class="hover:bg-muted/50 transition-colors group cursor-pointer"
            @click="playTrack(index)"
          >
            <TableCell class="text-center text-muted-foreground font-mono text-xs">
              <span class="group-hover:hidden">{{ index + 1 }}</span>
              <Play class="hidden group-hover:block w-4 h-4 mx-auto text-primary fill-current" />
            </TableCell>

            <TableCell v-if="showCover" class="p-2">
              <div class="w-10 h-10 mx-auto rounded overflow-hidden border shadow-sm relative bg-secondary flex items-center justify-center">
                <Disc class="absolute w-5 h-5 opacity-20 z-0" />
                <SafeImage 
                  v-if="item.custom_cover_type || item.albumCoverType"
                  :src="getTrackImageUrl(item.id)" 
                  type="track" 
                  class="relative z-10 w-full h-full object-cover"
                />
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
                      <span class="hover:underline hover:text-primary cursor-pointer" @click.stop="goToArtist(artistName)">
                        {{ artistName }}
                      </span>
                      <span v-if="aIdx < getArtistList(item.artist).length - 1" class="mr-1">,</span>
                    </template>
                  </template>
                  
                  <span v-if="showArtist && showAlbum" class="mx-1.5">•</span>
                  
                  <template v-if="showAlbum">
                    <span class="hover:underline hover:text-primary cursor-pointer" @click.stop="goToAlbum(item.albumId)">
                      {{ item.albumName || 'Unknown Album' }}
                    </span>
                  </template>
                </div>
              </div>
            </TableCell>

            <TableCell class="text-center text-sm font-medium text-muted-foreground tabular-nums">
              {{ formatTrackTime(item.duration) }}
            </TableCell>
            
            <TableCell class="text-center text-sm text-muted-foreground">{{ item.year || '-' }}</TableCell>

            <TableCell class="text-center" @click.stop>
              <Popover>
                <PopoverTrigger as-child>
                  <button class="text-yellow-500 text-sm tracking-widest hover:scale-105 transition-transform focus:outline-none">
                    {{ renderStars(item.rating) }}
                  </button>
                </PopoverTrigger>
                <PopoverContent class="w-auto p-2" align="center">
                  <div class="flex gap-1">
                    <button v-for="star in 5" :key="star" @click="updateRating(item, star)"
                            class="text-2xl hover:scale-125 transition-transform focus:outline-none"
                            :class="star <= (item.rating || 0) ? 'text-yellow-500' : 'text-muted'">
                      ★
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </TableCell>

            <TableCell class="text-center font-bold text-primary tabular-nums">{{ item.play_count || 0 }}</TableCell>
            
            <TableCell class="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none" @click.stop>
                    <MoreVertical class="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" class="w-48">
                  <DropdownMenuItem v-if="showAlbum" @click.stop="goToAlbum(item.albumId)">
                    <Disc class="mr-2 h-4 w-4" /> 앨범으로 이동
                  </DropdownMenuItem>
                  <DropdownMenuItem v-if="showArtist" @click.stop="goToArtist(item.artist)">
                    <Users class="mr-2 h-4 w-4" /> 아티스트로 이동
                  </DropdownMenuItem>
                  <DropdownMenuItem @click.stop>
                    <ListPlus class="mr-2 h-4 w-4" /> 다음에 재생
                  </DropdownMenuItem>
                  <DropdownMenuItem @click.stop="fetchMetadata(item.id)">
                    <Sparkles class="mr-2 h-4 w-4 text-yellow-500" /> 메타데이터 업데이트
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <div class="md:hidden flex flex-col">
      <div 
        v-for="(item, index) in tracks" 
        :key="`mob-${item.id}`"
        class="flex items-center gap-3 p-3 border-b border-border/50 hover:bg-muted/30 active:bg-muted/50 transition-colors"
        @click="playTrack(index)"
      >
        <div v-if="showCover" class="relative w-14 h-14 rounded-md overflow-hidden shrink-0 shadow-sm border bg-secondary flex items-center justify-center">
          <Disc class="absolute w-6 h-6 opacity-20 z-0" />
          <SafeImage 
            v-if="item.custom_cover_type || item.albumCoverType"
            :src="getTrackImageUrl(item.id)" 
            type="track" 
            class="relative z-10 w-full h-full object-cover"
          />
          <div class="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity z-20">
            <Play class="w-6 h-6 text-white fill-current" />
          </div>
        </div>

        <div class="flex flex-col min-w-0 flex-1 gap-0.5">
          <div class="flex items-start justify-between gap-2">
            <span class="font-bold text-sm truncate">{{ item.title }}</span>
            <div class="flex items-center gap-1 shrink-0 -mr-1">
              <button @click.stop="toggleStar(item)" class="p-1 focus:outline-none">
                <Heart class="w-4 h-4" :class="item.starred ? 'text-red-500 fill-current' : 'text-muted-foreground'" />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <button class="p-1 text-muted-foreground focus:outline-none" @click.stop>
                    <MoreVertical class="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" class="w-48">
                  <DropdownMenuItem v-if="showAlbum" @click.stop="goToAlbum(item.albumId)">
                    <Disc class="mr-2 h-4 w-4" /> 앨범으로 이동
                  </DropdownMenuItem>
                  <DropdownMenuItem v-if="showArtist" @click.stop="goToArtist(item.artist)">
                    <Users class="mr-2 h-4 w-4" /> 아티스트로 이동
                  </DropdownMenuItem>
                  <DropdownMenuItem @click.stop="fetchMetadata(item.id)">
                    <Sparkles class="mr-2 h-4 w-4 text-yellow-500" /> 메타데이터 업데이트
                  </DropdownMenuItem>
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
                <PopoverTrigger as-child>
                  <button class="text-yellow-500 tracking-wider font-sans focus:outline-none">{{ renderStars(item.rating) }}</button>
                </PopoverTrigger>
                <PopoverContent class="w-auto p-2" align="start" side="top">
                  <div class="flex gap-2">
                    <button v-for="star in 5" :key="star" @click="updateRating(item, star)"
                            class="text-2xl focus:outline-none"
                            :class="star <= (item.rating || 0) ? 'text-yellow-500' : 'text-muted'">★</button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <span class="text-primary/70 font-bold">{{ item.play_count || 0 }}회</span>
            <span>{{ formatTrackTime(item.duration) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>