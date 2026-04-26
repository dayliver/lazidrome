<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getCoverUrl } from '@/lib/image' // 💡 공통 이미지 URL 생성기

import { Input } from '@/components/ui/input'
import SafeImage from '@/components/shared/SafeImage.vue'
import { Search, Hash, Tags } from 'lucide-vue-next'
import ViewHeader from '@/components/shared/ViewHeader.vue'

const router = useRouter()
const authStore = useAuthStore()

const tags = ref([])
const isLoading = ref(true)
const searchQuery = ref('')

// 💡 1. 백엔드에서 통합 태그 데이터를 가져옵니다.
const fetchTags = async () => {
  try {
    const res = await authStore.fetchWithAuth('/api/tags')
    const result = await res.json()
    if (result.success) {
      tags.value = result.data
    }
  } catch (err) {
    console.error('태그 로드 실패:', err)
  } finally {
    isLoading.value = false
  }
}

onMounted(fetchTags)

// 💡 2. 검색어에 맞춰 태그 필터링
const filteredTags = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return tags.value
  return tags.value.filter(t => t.name.toLowerCase().includes(q))
})

// 💡 3. 이미지가 있는 태그만 따로 뽑아 상단(Featured)에 배치
const featuredTags = computed(() => {
  return filteredTags.value.filter(t => t.hasImage)
})

// 태그 상세 페이지로 이동
const goToTag = (name) => {
  router.push({ name: 'tag-detail', params: { name } })
}

// 💡 태그 이미지 URL 생성 
// (주의: 백엔드 images.js에 '/api/images/tag/:id' 라우트를 추가해야 합니다!)
const getTagImageUrl = (name) => getCoverUrl(authStore.serverUrl, 'tag', name, authStore.token)

const handleCreate = () => {
  console.log('파일 업로드 탐색기 띄우기 (나중에 연결)')
}
</script>

<template>
  <div class="w-full space-y-8 animate-in fade-in duration-500">
    
    <ViewHeader
      title="Tags"
      :description="`음악을 분류하는 모든 태그 (총 ${tags.length}개)`"
      @action="handleCreate"
    >
      <template #title-prefix>
        <Tags class="inline w-8 h-8 text-primary mr-3" />
      </template>
    </ViewHeader>

    <div v-if="isLoading" class="py-20 flex flex-col items-center justify-center text-muted-foreground">
      <span class="animate-spin border-4 border-primary/30 border-t-primary rounded-full w-10 h-10 mb-4"></span>
      <p class="font-bold tracking-tight">태그 데이터를 분석 중입니다...</p>
    </div>

    <template v-else>
      <section v-if="featuredTags.length > 0" class="space-y-4 animate-in slide-in-from-bottom-4">
        <h2 class="text-lg font-black tracking-tight flex items-center gap-2 px-1">
          <span class="text-primary">✨</span> 시각적 태그
        </h2>
        
        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <div
            v-for="tag in featuredTags"
            :key="`feat-${tag.name}`"
            @click="goToTag(tag.name)"
            class="relative aspect-square rounded-2xl overflow-hidden cursor-pointer group shadow-sm border border-border/50 bg-muted"
          >
            <SafeImage
              :src="getTagImageUrl(tag.name)"
              type="tag"
              class="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10 opacity-80 group-hover:opacity-100 transition-opacity"></div>
            
            <div class="absolute inset-0 flex flex-col items-center justify-center p-4 text-white">
              <span class="font-black text-2xl tracking-tight text-center drop-shadow-lg group-hover:text-primary transition-colors">{{ tag.name }}</span>
              <span class="text-[11px] font-bold opacity-80 mt-1 uppercase tracking-widest">{{ tag.count }} 항목</span>
            </div>
          </div>
        </div>
      </section>

      <section class="space-y-4 pt-4 animate-in slide-in-from-bottom-8">
        
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/20 p-4 rounded-xl border">
          <h2 class="text-lg font-black tracking-tight px-1">모든 태그</h2>
          <div class="relative w-full sm:w-80">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              v-model="searchQuery"
              placeholder="태그 검색..."
              class="pl-9 bg-background border-2 focus-visible:ring-primary font-bold shadow-sm"
            />
          </div>
        </div>

        <div v-if="filteredTags.length === 0" class="py-16 text-center border-2 border-dashed rounded-2xl bg-muted/5">
          <Hash class="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p class="font-bold text-muted-foreground text-lg">검색된 태그가 없습니다.</p>
        </div>

        <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div
            v-for="tag in filteredTags"
            :key="tag.name"
            @click="goToTag(tag.name)"
            class="flex items-center justify-between p-3.5 bg-card border-2 rounded-xl hover:border-primary/50 hover:shadow-sm cursor-pointer transition-all group"
          >
            <div class="flex items-center gap-2 min-w-0">
              <Hash class="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
              <span class="font-bold text-sm truncate group-hover:text-foreground transition-colors">{{ tag.name }}</span>
            </div>
            <span class="text-[10px] font-mono font-black text-muted-foreground bg-muted px-2 py-1 rounded-md group-hover:bg-primary/10 group-hover:text-primary transition-colors">
              {{ tag.count }}
            </span>
          </div>
        </div>

      </section>
    </template>

  </div>
</template>