<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { useAuthStore } from '@/stores/auth' // fetchWithAuth 사용을 위해 필요할 수 있음
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Hash, Play, Shuffle, MoreVertical, ListMusic } from 'lucide-vue-next'

const router = useRouter()
const library = useLibraryStore()
const player = usePlayerStore()
const auth = useAuthStore()

const tagsData = ref([])
const isLoading = ref(true)

// API에서 태그 목록 가져오기
const loadTags = async () => {
  isLoading.value = true
  try {
    // 💡 참고: library.js에 getTags() 메서드를 추가해야 합니다!
    // 임시로 직접 fetch 하는 로직을 작성해 둡니다.
    const res = await auth.fetchWithAuth('/api/tags')
    if (res.ok) {
      tagsData.value = await res.json()
    }
  } catch (error) {
    console.error("태그 데이터를 불러오는 중 에러 발생:", error)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadTags()
})

// 특정 태그의 곡들을 가져와서 재생하는 로직
const playTagTracks = async (tagName, isShuffle = false) => {
  try {
    const res = await auth.fetchWithAuth(`/api/tags/${encodeURIComponent(tagName)}/tracks`)
    if (res.ok) {
      const tracks = await res.json()
      if (tracks.length > 0) {
        player.isShuffle = isShuffle
        const startIndex = isShuffle ? Math.floor(Math.random() * tracks.length) : 0
        player.playNewQueue(tracks, startIndex)
      }
    }
  } catch (error) {
    console.error("태그 재생 중 에러 발생:", error)
  }
}
</script>

<template>
  <div class="w-full space-y-6">
    
    <div class="flex items-end justify-between border-b pb-4">
      <h1 class="text-3xl font-black tracking-tight">Tags</h1>
      <p class="text-sm font-medium text-muted-foreground">
        분류된 태그 (총 {{ tagsData.length }}개)
      </p>
    </div>

    <div v-if="isLoading" class="p-16 text-center text-muted-foreground flex flex-col items-center gap-4">
      <div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      <p>태그 데이터를 분석하고 있습니다...</p>
    </div>
    
    <div v-else-if="tagsData.length === 0" class="p-16 text-center text-muted-foreground flex flex-col items-center gap-4">
      <Hash class="w-12 h-12 opacity-20" />
      <p>등록된 태그가 없습니다. 곡에 태그를 추가해 보세요!</p>
    </div>

    <div v-else class="bg-card border rounded-lg shadow-sm overflow-hidden">
      <Table>
        <TableHeader class="bg-muted/30">
          <TableRow>
            <TableHead class="w-[60px] text-center">#</TableHead>
            <TableHead>태그 이름</TableHead>
            <TableHead class="text-center w-[120px]">보유 곡 수</TableHead>
            <TableHead class="text-center w-[120px]">총 재생 횟수</TableHead>
            <TableHead class="w-[80px] text-right"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow 
            v-for="(tag, index) in tagsData" 
            :key="tag.name"
            class="group hover:bg-muted/50 transition-colors"
          >
            <TableCell class="text-center text-muted-foreground font-mono text-xs">
              {{ index + 1 }}
            </TableCell>

            <TableCell>
              <div class="flex items-center gap-2 font-bold text-base cursor-pointer hover:text-primary transition-colors" @click="playTagTracks(tag.name, false)">
                <Hash class="w-4 h-4 text-muted-foreground opacity-50" />
                {{ tag.name }}
              </div>
            </TableCell>

            <TableCell class="text-center font-medium text-muted-foreground tabular-nums">
              {{ tag.trackCount || 0 }}곡
            </TableCell>

            <TableCell class="text-center font-bold text-primary/80 tabular-nums">
              {{ tag.totalPlays || 0 }}회
            </TableCell>
            
            <TableCell class="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none">
                    <MoreVertical class="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" class="w-48">
                  <DropdownMenuItem @click="playTagTracks(tag.name, false)">
                    <Play class="mr-2 h-4 w-4" /> 처음부터 재생
                  </DropdownMenuItem>
                  <DropdownMenuItem @click="playTagTracks(tag.name, true)">
                    <Shuffle class="mr-2 h-4 w-4" /> 셔플 재생
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>

          </TableRow>
        </TableBody>
      </Table>
    </div>

  </div>
</template>