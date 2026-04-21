<script setup>
import { ref, watch } from 'vue'
import { useLibraryStore } from '@/stores/library'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const library = useLibraryStore()

const ratingsData = ref([])
const isLoading = ref(true)

// DB가 준비되면 스토어에서 평점 통계 데이터를 가져옵니다.
watch(() => library.isDBReady, async (isReady) => {
  if (!isReady) return
  
  isLoading.value = true
  try {
    ratingsData.value = await library.getRatings()
  } catch (error) {
    console.error("평점 데이터를 불러오는 중 에러 발생:", error)
  } finally {
    isLoading.value = false
  }
}, { immediate: true })

// 별점 렌더링 헬퍼 함수
const renderStars = (rating) => {
  const r = rating || 0
  return '★'.repeat(r) + '☆'.repeat(5 - r)
}
</script>

<template>
  <div class="container max-w-5xl py-8 space-y-6">
    
    <div class="flex items-end justify-between border-b pb-4">
      <h1 class="text-3xl font-black tracking-tight">Ratings</h1>
      <p class="text-sm font-medium text-muted-foreground">
        총 {{ ratingsData.length }}개의 평점 그룹
      </p>
    </div>

    <div class="bg-card border rounded-lg shadow-sm overflow-hidden">
      
      <div v-if="isLoading" class="p-16 text-center text-muted-foreground flex flex-col items-center gap-4">
        <div class="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p>평점 데이터를 분석하고 있습니다...</p>
      </div>
      
      <Table v-else>
        <TableHeader>
          <TableRow class="bg-muted/30">
            <TableHead class="w-[300px]">별점</TableHead>
            <TableHead class="text-center w-[150px]">곡 수</TableHead>
            <TableHead>대표곡 (최다 재생)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow 
            v-for="item in ratingsData" 
            :key="item.rating"
            class="hover:bg-muted/50 transition-colors group cursor-pointer"
          >
            <TableCell class="font-bold text-base">
              <span v-if="item.rating === 0" class="text-muted-foreground font-medium">
                평가 없음 (Unrated)
              </span>
              <span v-else class="text-yellow-500 tracking-widest text-lg drop-shadow-sm">
                {{ renderStars(item.rating) }}
              </span>
            </TableCell>
            
            <TableCell class="text-center">
              <span class="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-secondary text-secondary-foreground text-sm font-medium">
                {{ item.trackCount }}곡
              </span>
            </TableCell>
            
            <TableCell class="text-muted-foreground group-hover:text-foreground transition-colors">
              {{ item.topTrack || '대표곡 정보 없음' }}
            </TableCell>
          </TableRow>
          
          <TableRow v-if="ratingsData.length === 0">
            <TableCell colspan="3" class="h-32 text-center text-muted-foreground">
              표시할 데이터가 없습니다.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
    
  </div>
</template>