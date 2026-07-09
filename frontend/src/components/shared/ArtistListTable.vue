<script setup>
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Play, MoreVertical, Users, Sparkles } from 'lucide-vue-next'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { useAuthStore } from '@/stores/auth'
import { useMetadataEditStore } from '@/stores/metadataEdit'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import SafeImage from '@/components/shared/SafeImage.vue'

// 💉 Props 정의: 외부에서 아티스트 배열을 주입받습니다.
const props = defineProps({
  artists: {
    type: Array,
    required: true,
    default: () => []
  }
})

const router = useRouter()
const library = useLibraryStore()
const player = usePlayerStore()
const auth = useAuthStore()
const metadataEdit = useMetadataEditStore()
const { t } = useI18n()

const goToArtistDetail = (artistId) => router.push({ name: 'artist-detail', params: { id: artistId } })

const playTopTrack = async (trackId) => {
  try {
    const [fullTrack] = await library.fetchTracksByIds([trackId])
    if (fullTrack) {
      player.playNewQueue([fullTrack], 0)
    } else {
      console.warn(t('artistTable.trackNotFound'))
    }
  } catch (error) {
    console.error('대표곡 재생 중 오류 발생:', error)
  }
}

const playArtistRandom = async (artist) => {
  try {
    const detail = await library.getArtistById(artist.id)
    const tracks = detail?.tracks ?? []
    if (tracks.length > 0) {
      player.isShuffle = true
      player.playNewQueue(tracks, Math.floor(Math.random() * tracks.length))
    }
  } catch (error) {
    console.error('아티스트 셔플 재생 중 오류:', error)
  }
}

const getArtistImageUrl = (id) => {
  return auth.coverSrc('artist', id)
}

const fetchMetadata = (artistId) => {
  if (!artistId) return
  metadataEdit.fetchPreview('artist', artistId)
}
</script>

<template>
  <Table>
    <TableHeader class="bg-muted/30">
      <TableRow>
        <TableHead class="w-[250px] md:w-[300px]">{{ t('artistTable.artist') }}</TableHead>
        <TableHead class="hidden md:table-cell w-[100px] text-center">{{ t('artistTable.trackCount') }}</TableHead>
        <TableHead class="hidden md:table-cell w-[160px]">{{ t('artistTable.topTags') }}</TableHead>
        <TableHead class="hidden lg:table-cell">{{ t('artistTable.topTracks') }}</TableHead>
        <TableHead class="w-[60px] text-right"></TableHead>
      </TableRow>
    </TableHeader>
    
    <TableBody>
      <TableRow v-for="artist in artists" :key="artist.id" class="cursor-pointer hover:bg-muted/50 group" @click="goToArtistDetail(artist.id)">
        
        <TableCell>
          <div class="flex items-center gap-4">
            <div class="relative w-12 h-12 md:w-14 md:h-14 rounded-full overflow-hidden bg-muted group-hover:shadow-md shrink-0 border"
                 @click.stop="playArtistRandom(artist)">
              <SafeImage
                v-if="artist.cover_type"
                :src="getArtistImageUrl(artist.id)"
                type="artist"
                class="absolute inset-0 w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-40"
              />
              <div v-else class="w-full h-full flex items-center justify-center font-bold text-muted-foreground bg-secondary text-lg">
                {{ artist.name[0].toUpperCase() }}
              </div>
              <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Play class="w-5 h-5 md:w-6 md:h-6 text-white fill-current drop-shadow-lg" />
              </div>
            </div>
            <div class="flex flex-col min-w-0">
              <span class="font-bold text-base md:text-lg truncate group-hover:text-primary transition-colors">{{ artist.name }}</span>
              <span class="md:hidden text-xs font-medium text-muted-foreground mt-0.5">
                {{ t('common.trackCount', { count: artist.trackCount }) }}
              </span>
            </div>
          </div>
        </TableCell>

        <TableCell class="hidden md:table-cell text-center font-medium text-muted-foreground tabular-nums">
          {{ t('common.trackCount', { count: artist.trackCount || 0 }) }}
        </TableCell>

        <TableCell class="hidden md:table-cell">
          <div v-if="artist.topTags && artist.topTags.length > 0" class="flex flex-wrap gap-1.5">
            <span v-for="tag in artist.topTags" :key="tag" class="px-2 py-0.5 bg-secondary text-secondary-foreground text-[10px] font-bold rounded-md truncate max-w-[70px]" :title="tag">
              {{ tag }}
            </span>
          </div>
          <span v-else class="text-[10px] text-muted-foreground">{{ t('common.noTags') }}</span>
        </TableCell>

        <TableCell class="hidden lg:table-cell">
          <div v-if="artist.topTracks && artist.topTracks.length > 0" class="flex flex-col gap-1">
            <button v-for="(track, idx) in artist.topTracks" :key="track.id" @click.stop="playTopTrack(track.id)" class="text-[11px] text-left text-muted-foreground hover:text-primary hover:underline truncate max-w-[200px] focus:outline-none">
              <span class="opacity-50 mr-1">{{ idx + 1 }}.</span>{{ track.title }}
            </button>
          </div>
          <span v-else class="text-xs text-muted-foreground">-</span>
        </TableCell>

        <TableCell class="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground focus:outline-none" @click.stop>
                <MoreVertical class="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-48">
              <DropdownMenuItem @click.stop="playArtistRandom(artist)">
                <Play class="mr-2 h-4 w-4" /> {{ t('artistTable.shuffleAll') }}
              </DropdownMenuItem>
              <DropdownMenuItem @click.stop="goToArtistDetail(artist.id)">
                <Users class="mr-2 h-4 w-4" /> {{ t('artistTable.viewDetails') }}
              </DropdownMenuItem>
              <DropdownMenuItem @click.stop="fetchMetadata(artist.id)">
                <Sparkles class="mr-2 h-4 w-4 text-rating" /> {{ t('artistTable.updateMetadata') }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>

      </TableRow>
    </TableBody>
  </Table>
</template>