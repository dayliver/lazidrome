<script setup>
import { useRouter } from 'vue-router'
import { useLibraryStore } from '@/stores/library'
import { useAuthStore } from '@/stores/auth'
import { usePlayerStore } from '@/stores/player'

import { formatDuration } from '@/lib/audio'
import { getCoverUrl } from '@/lib/image'

import { Play, MoreVertical, Shuffle, Info, Disc } from 'lucide-vue-next'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

// 💉 1. Props 정의: 외부에서 앨범 배열 데이터를 주입받습니다.
const props = defineProps({
  albums: {
    type: Array,
    required: true,
    default: () => []
  }
})

const router = useRouter()
const library = useLibraryStore()
const auth = useAuthStore()
const player = usePlayerStore()

const getAlbumImageUrl = (id) => {
  return getCoverUrl(auth.serverUrl, 'album', id, auth.token)
}

const playAlbumSequential = async (albumName) => {
  const tracks = await library.getTracksByAlbum(albumName)
  if (tracks.length > 0) player.playAlbum(tracks)
}

const playAlbumShuffle = async (albumName) => {
  const tracks = await library.getTracksByAlbum(albumName)
  if (tracks.length > 0) player.playAlbum(tracks, null, true)
}

const goToAlbumDetail = (albumId) => {
  router.push({ name: 'album-detail', params: { id: albumId } })
}
</script>

<template>
  <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6 pb-12">
    
    <div 
      v-for="item in albums" 
      :key="item.id"
      class="group flex flex-col gap-3"
    >
      <div class="relative aspect-square w-full rounded-xl overflow-hidden bg-muted shadow-sm ring-1 ring-border cursor-pointer transition-all duration-300 group-hover:shadow-xl group-hover:-translate-y-1" 
           @click="goToAlbumDetail(item.id)">
        
        <div class="absolute inset-0 flex items-center justify-center font-bold text-muted-foreground bg-secondary z-0">
          <Disc class="w-1/3 h-1/3 opacity-30" />
        </div>
        
        <img 
          v-if="item.cover_type" 
          :src="getAlbumImageUrl(item.id)" 
          @error="(e) => e.target.style.opacity='0'"
          crossorigin="anonymous" loading="lazy" 
          class="absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover:scale-105 z-10" 
          alt="Cover" 
        />

        <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-20">
          <button class="w-14 h-14 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-transform focus:outline-none"
                  @click.stop="playAlbumSequential(item.name)">
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
              {{ item.displayArtist || 'Unknown Artist' }}
            </span>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="ghost" size="icon" class="h-6 w-6 -mr-2 text-muted-foreground hover:text-foreground shrink-0 focus:outline-none" @click.stop>
                <MoreVertical class="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-48">
              <DropdownMenuItem @click.stop="playAlbumShuffle(item.name)">
                <Shuffle class="mr-2 h-4 w-4" /> 셔플 재생
              </DropdownMenuItem>
              <DropdownMenuItem @click.stop="goToAlbumDetail(item.id)">
                <Info class="mr-2 h-4 w-4" /> 앨범 정보
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div class="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground/70 font-medium font-mono">
          <span>{{ item.year || '-' }}</span>
          <span>•</span>
          <span>{{ item.trackCount || 0 }}곡</span>
          <span v-if="item.totalDuration">•</span>
          <span v-if="item.totalDuration">{{ formatDuration(item.totalDuration) }}</span>
        </div>

      </div>
    </div>

  </div>
</template>