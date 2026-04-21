<script setup>
import { ref, watch } from 'vue'
import { useLibraryStore } from '@/stores/library'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const library = useLibraryStore()

const genresData = ref([])
const isLoading = ref(true)

// DB가 준비되면 스토어에서 장르 통계 데이터를 가져옵니다.
watch(() => library.isDBReady, async (isReady) => {
  if (!isReady) return
  
  isLoading.value = true
  try {
    genresData.value = await library.getGenres()
  } catch (error) {
    console.error("장르 데이터를 불러오는 중 에러 발생:", error)
  } finally {
    isLoading.value = false
  }
}, { immediate: true })
</script>

<template>
  <div class="container max-w-5xl py-8 space-y-6">
    
    <div class="flex items-end justify-between border-b pb-4">
      <h1 class="text-3xl font-black tracking-tight">Genres</h1>
      <p class="text-sm font-medium text-muted-foreground">
        총 {{ genresData.length }}개의 장르
      </p>
    </div>

    <div class="bg-card border rounded-lg shadow-sm overflow-hidden">
      
      <div v-if="isLoading" class="p-16 text-center text-muted-foreground flex flex-col items-center gap-4">
        <div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p>장르 데이터를 분석하고 있습니다...</p>
      </div>
      
      <Table v-else>
        <TableHeader>
          <TableRow class="bg-muted/30">
            <TableHead class="w-[300px]">장르</TableHead>
            <TableHead class="text-center w-[150px]">곡 수</TableHead>
            <TableHead>대표곡 (최다 재생 & 최고 평점)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow 
            v-for="item in genresData" 
            :key="item.genre"
            class="hover:bg-muted/50 transition-colors group cursor-pointer"
          >
            <TableCell class="font-bold text-base group-hover:text-primary transition-colors">
              {{ item.genre }}
            </TableCell>
            
            <TableCell class="text-center">
              <span class="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-secondary text-secondary-foreground text-sm font-medium">
                {{ item.trackCount }}곡
              </span>
            </TableCell>
            
            <TableCell class="text-muted-foreground">
              {{ item.topTrack || '대표곡 정보 없음' }}
            </TableCell>
          </TableRow>
          
          <TableRow v-if="genresData.length === 0">
            <TableCell colspan="3" class="h-32 text-center text-muted-foreground">
              표시할 장르가 없습니다.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
    
  </div>
</template>