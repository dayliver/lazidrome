<script setup>
import { ref, computed, watch } from 'vue'
import { useEnrichmentStore } from '@/stores/enrichment'
import { useLibraryStore } from '@/stores/library' // 💉 라이브러리 스토어 추가
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X, ArrowRight, Check, SkipForward, RefreshCw } from 'lucide-vue-next'

const enrichment = useEnrichmentStore()
const library = useLibraryStore()
const item = computed(() => enrichment.currentItem)

// 💉 수동 입력을 위한 반응형 상태
const editTitle = ref('')
const editArtist = ref('')

// 큐의 항목이 바뀔 때마다 입력창 값을 로컬 데이터로 초기화합니다.
watch(item, (newItem) => {
  if (newItem && newItem.local) {
    editTitle.value = newItem.local.title || newItem.local.name || ''
    editArtist.value = newItem.local.artistName || ''
  }
}, { immediate: true })

const handleSkip = () => {
  enrichment.shiftQueue()
}

// 💉 수동 다시 검색 트리거
const handleReSearch = async () => {
  if (!editTitle.value) return
  await enrichment.reFetchPreview(editTitle.value, editArtist.value)
}

// 적용하기 로직 강화 (새로고침 연동)
const handleApply = async () => {
  if (!item.value) return
  
  // 💉 수동으로 수정한 제목과 아티스트 정보를 함께 넘겨줍니다!
  await enrichment.applyEnrichment(item.value, editTitle.value, editArtist.value)
  
  await library.getTracks(true) 
  // enrichment.shiftQueue()는 applyEnrichment 성공 시 내부에서 호출되므로 여기서 빼도 됩니다. (중복 방지)
}
</script>

<template>
  <div v-if="item" class="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
    
    <div class="bg-card w-full max-w-4xl rounded-xl shadow-2xl border flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
      
      <div class="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
        <div>
          <h2 class="text-xl font-black flex items-center gap-2">
            메타데이터 검토
            <span v-if="enrichment.isFetching" class="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
          </h2>
          <p class="text-xs text-muted-foreground mt-1">
            {{ item.type.toUpperCase() }} 업데이트 대기 중... (남은 큐: {{ enrichment.reviewQueue.length }}개)
          </p>
        </div>
        <Button variant="ghost" size="icon" @click="handleSkip" class="rounded-full">
          <X class="w-5 h-5" />
        </Button>
      </div>

      <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 relative">
        
        <div class="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-background border rounded-full items-center justify-center z-10 shadow-sm">
          <ArrowRight class="w-5 h-5 text-muted-foreground" />
        </div>

        <div class="space-y-4">
          <div class="flex items-center justify-between mb-2">
            <div class="inline-block px-3 py-1 bg-secondary text-secondary-foreground text-xs font-bold rounded-full">
              현재 로컬 데이터 (수정 가능)
            </div>
            <Button size="sm" variant="ghost" @click="handleReSearch" :disabled="enrichment.isFetching">
              <RefreshCw class="w-4 h-4 mr-1" /> 검색
            </Button>
          </div>
          
          <div class="space-y-3">
            <div>
              <p class="text-xs text-muted-foreground font-bold uppercase mb-1">제목 (Title)</p>
              <Input v-model="editTitle" placeholder="곡 제목 입력" @keyup.enter="handleReSearch" />
            </div>
            
            <div v-if="item.local?.artistName !== undefined">
              <p class="text-xs text-muted-foreground font-bold uppercase mb-1">아티스트</p>
              <Input v-model="editArtist" placeholder="아티스트 입력" @keyup.enter="handleReSearch" />
            </div>

            <div>
              <p class="text-xs text-muted-foreground font-bold uppercase mb-1">수록 앨범</p>
              <p class="font-medium bg-muted/50 p-2 rounded-md">{{ item.local?.albumName || '알 수 없는 앨범' }}</p>
            </div>

            <div>
              <p class="text-xs text-muted-foreground font-bold uppercase mb-1">보유 태그</p>
              <div class="flex flex-wrap gap-1 bg-muted/50 p-2 rounded-md min-h-[40px]">
                <span v-for="tag in (item.local?.tags ? JSON.parse(item.local.tags) : [])" :key="tag" 
                      class="px-2 py-0.5 bg-background border text-xs rounded-md">
                  #{{ tag }}
                </span>
                <span v-if="!item.local?.tags || item.local.tags === '[]'" class="text-muted-foreground text-sm">태그 없음</span>
              </div>
            </div>
          </div>
        </div>

        <div class="space-y-4" :class="{'opacity-50 pointer-events-none': enrichment.isFetching}">
          <div class="inline-block px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full mb-2">
            Last.fm 제안 데이터
          </div>
          
          <div class="space-y-3">
            <div>
              <p class="text-xs text-muted-foreground font-bold uppercase mb-1">제목 (Title)</p>
              <p class="font-medium bg-primary/10 border border-primary/20 p-2 rounded-md text-primary">{{ item.external?.title || item.external?.name || '없음' }}</p>
            </div>
            
            <div v-if="item.external?.artist">
              <p class="text-xs text-muted-foreground font-bold uppercase mb-1">아티스트</p>
              <p class="font-medium bg-primary/10 border border-primary/20 p-2 rounded-md text-primary">{{ item.external.artist }}</p>
            </div>

            <div>
              <p class="text-xs text-muted-foreground font-bold uppercase mb-1">제안 앨범 및 커버</p>
              <div class="flex items-center gap-3 bg-primary/10 border border-primary/20 p-2 rounded-md">
                <img v-if="item.external?.imageUrl" :src="item.external.imageUrl" class="w-10 h-10 rounded shadow-sm object-cover" />
                <div v-else class="w-10 h-10 rounded bg-black/10 flex items-center justify-center text-xs">No Img</div>
                <p class="font-medium text-primary flex-1 truncate">{{ item.external?.albumName || '앨범 정보 없음' }}</p>
              </div>
            </div>

            <div>
              <p class="text-xs text-muted-foreground font-bold uppercase mb-1">추가될 태그</p>
              <div class="flex flex-wrap gap-1 bg-primary/10 border border-primary/20 p-2 rounded-md min-h-[40px]">
                <span v-for="tag in item.external?.tags" :key="tag" 
                      class="px-2 py-0.5 bg-background border border-primary/30 text-primary text-xs rounded-md">
                  #{{ tag }}
                </span>
                <span v-if="!item.external?.tags?.length" class="text-muted-foreground text-sm">추천 태그 없음</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      <div class="p-4 border-t bg-muted/30 flex items-center justify-end gap-3">
        <Button variant="outline" @click="handleSkip">
          <SkipForward class="w-4 h-4 mr-2" /> 건너뛰기
        </Button>
        <Button @click="handleApply" class="shadow-md" :disabled="enrichment.isFetching">
          <Check class="w-4 h-4 mr-2" /> 이 데이터로 덮어쓰기
        </Button>
      </div>

    </div>
  </div>
</template>