<script setup>
import { useRouter } from 'vue-router'
import { usePlaylistStore } from '@/stores/playlist'
import { useAuthStore } from '@/stores/auth' // 💡 커버 이미지 로드용
import { getCoverUrl } from '@/lib/image'    // 💡 커버 이미지 로드용

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { ListMusic, Zap, MoreVertical, Play, Trash2, Edit } from 'lucide-vue-next'
import SafeImage from '@/components/ui/SafeImage.vue' // 💡 안전한 썸네일 렌더러

const props = defineProps({
  playlists: {
    type: Array,
    required: true,
    default: () => []
  }
})

const emit = defineEmits(['edit'])

const router = useRouter()
const playlistStore = usePlaylistStore()
const authStore = useAuthStore()

// 💡 헬퍼 함수: 플레이리스트 커버 이미지 URL 생성
const getPlaylistImageUrl = (id) => getCoverUrl(authStore.serverUrl, 'playlist', id, authStore.token)

const goToDetail = (id) => {
  router.push({ name: 'playlist-detail', params: { id } })
}

const deletePlaylist = async (id, name) => {
  if (confirm(`'${name}' 플레이리스트를 정말 삭제하시겠습니까?`)) {
    await playlistStore.deletePlaylist(id)
  }
}

const getListSummary = (pl) => {
  if (pl.firstTrackTitle) {
    const artist = pl.firstTrackArtist || 'Unknown'
    let summary = `${pl.firstTrackTitle} • ${artist}`
    if (pl.trackCount > 1) summary += ` 외 ${pl.trackCount - 1}곡`
    if (pl.totalDuration) summary += ` (${pl.totalDuration})`
    return summary
  }
  return pl.description || '수동 플레이리스트'
}

const getMixSummary = (pl) => {
  if (pl.description) return pl.description
  if (pl.rules && pl.rules.conditions?.length > 0) {
    return pl.rules.conditions.map(c => {
      const fieldName = c.field === 'rating' ? '별점' : c.field === 'tags' ? '태그' : c.field
      return `${fieldName} ${c.value}`
    }).join(' • ')
  }
  return '스마트 믹스 (조건 설정 필요)'
}

const formatDate = (dateString) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit'
  })
}
</script>

<template>
  <div class="w-full">
    
    <div class="hidden md:block">
      <Table class="border-b">
        <TableHeader>
          <TableRow class="bg-muted/30">
            <TableHead class="w-[60px] text-center">#</TableHead>
            <TableHead class="w-16 text-center">커버</TableHead>
            <TableHead>플레이리스트 정보</TableHead>
            <TableHead class="w-32 text-center">생성일</TableHead>
            <TableHead class="w-16"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow 
            v-for="(pl, index) in playlists" 
            :key="pl.id"
            class="hover:bg-muted/50 transition-colors group cursor-pointer"
            @click="goToDetail(pl.id)"
          >
            <TableCell class="text-center text-muted-foreground font-mono text-xs">
              <span class="group-hover:hidden">{{ index + 1 }}</span>
              <Play class="hidden group-hover:block w-4 h-4 mx-auto text-primary fill-current" />
            </TableCell>

            <TableCell class="p-2">
              <div class="relative w-10 h-10 mx-auto rounded overflow-hidden border shadow-sm flex items-center justify-center bg-secondary transition-colors">
                <Zap v-if="pl.type === 'mix'" class="w-5 h-5 text-muted-foreground/40 absolute z-0" />
                <ListMusic v-else class="w-5 h-5 text-muted-foreground/40 absolute z-0" />
                
                <SafeImage 
                  v-if="pl.cover_type" 
                  :src="getPlaylistImageUrl(pl.id)" 
                  type="playlist" 
                  class="w-full h-full object-cover relative z-10" 
                />
              </div>
            </TableCell>

            <TableCell>
              <div class="flex flex-col min-w-0">
                <span class="font-bold text-base truncate">{{ pl.name }}</span>
                <div class="flex items-center gap-1 mt-0.5 text-xs font-medium truncate text-muted-foreground">
                  <Zap v-if="pl.type === 'mix'" class="w-3 h-3 shrink-0 fill-current" />
                  <ListMusic v-else class="w-3 h-3 shrink-0" />
                  <span class="truncate">{{ pl.type === 'mix' ? getMixSummary(pl) : getListSummary(pl) }}</span>
                </div>
              </div>
            </TableCell>

            <TableCell class="text-center text-sm font-medium text-muted-foreground tabular-nums">
              {{ formatDate(pl.created_at) }}
            </TableCell>

            <TableCell class="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none" @click.stop>
                    <MoreVertical class="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" class="w-40">
                  <DropdownMenuItem @click.stop="emit('edit', pl)">
                    <Edit class="mr-2 h-4 w-4" /> 정보 수정
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem @click.stop="deletePlaylist(pl.id, pl.name)" class="text-red-500 focus:text-red-500 focus:bg-red-500/10">
                    <Trash2 class="mr-2 h-4 w-4" /> 삭제
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
        v-for="(pl, index) in playlists" 
        :key="`mob-${pl.id}`"
        class="flex items-center gap-3 p-3 border-b border-border/50 hover:bg-muted/30 active:bg-muted/50 transition-colors cursor-pointer group"
        @click="goToDetail(pl.id)"
      >
        <div class="relative w-12 h-12 rounded-md overflow-hidden shrink-0 shadow-sm border flex items-center justify-center bg-secondary transition-colors">
          <Zap v-if="pl.type === 'mix'" class="w-6 h-6 text-muted-foreground/40 absolute z-0" />
          <ListMusic v-else class="w-6 h-6 text-muted-foreground/40 absolute z-0" />
          
          <SafeImage 
            v-if="pl.cover_type" 
            :src="getPlaylistImageUrl(pl.id)" 
            type="playlist" 
            class="w-full h-full object-cover relative z-10" 
          />

          <div class="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20">
            <Play class="w-5 h-5 text-white fill-current" />
          </div>
        </div>

        <div class="flex flex-col min-w-0 flex-1 gap-0.5">
          <div class="flex items-start justify-between gap-2">
            <span class="font-bold text-sm truncate">{{ pl.name }}</span>
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <button class="p-1 -mr-1 text-muted-foreground focus:outline-none" @click.stop>
                  <MoreVertical class="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem @click.stop="emit('edit', pl)">
                  <Edit class="mr-2 h-4 w-4" /> 정보 수정
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem @click.stop="deletePlaylist(pl.id, pl.name)" class="text-red-500">
                  <Trash2 class="mr-2 h-4 w-4" /> 삭제
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <div class="flex items-center gap-1 mt-0.5 text-[11px] font-medium truncate"
               :class="pl.type === 'mix' ? 'text-purple-500' : 'text-muted-foreground'">
            <Zap v-if="pl.type === 'mix'" class="w-3 h-3 shrink-0 fill-current" />
            <ListMusic v-else class="w-3 h-3 shrink-0" />
            <span class="truncate">{{ pl.type === 'mix' ? getMixSummary(pl) : getListSummary(pl) }}</span>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>