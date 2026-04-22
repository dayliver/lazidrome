<script setup>
import { ref, onMounted } from 'vue'
import { UserPlus, Trash2, User, Search, Users } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLibraryStore } from '@/stores/library'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  }
})
const emit = defineEmits(['update:modelValue'])

const library = useLibraryStore()

// 검색 및 자동완성 상태
const searchQuery = ref('')
const searchResults = ref([])
const allArtists = ref([])
const isFocused = ref(false)

// 마운트 시 라이브러리 전체 아티스트 목록을 가져와 캐싱합니다.
onMounted(async () => {
  allArtists.value = await library.getArtists()
})

// 💡 아티스트 검색 로직
const handleSearch = () => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) {
    searchResults.value = []
    return
  }
  // 이름에 검색어가 포함된 아티스트 최대 5명 추출
  searchResults.value = allArtists.value
    .filter(a => a.name.toLowerCase().includes(query))
    .slice(0, 5)
}

// 💡 아티스트 추가 로직 (기존 아티스트 객체 OR 신규 이름 문자열)
const addArtist = (artistOrName) => {
  let id = null
  let name = ''

  if (typeof artistOrName === 'string') {
    name = artistOrName.trim()
    if (!name) return
  } else {
    id = artistOrName.id
    name = artistOrName.name
  }

  // 중복 검사
  if (props.modelValue.some(a => a.name.toLowerCase() === name.toLowerCase())) {
    alert('이미 추가된 앨범 아티스트입니다.')
    searchQuery.value = ''
    searchResults.value = []
    return
  }

  // 💉 역할(role_mask) 로직을 제거하고 이름과 ID만 깔끔하게 추가합니다.
  const updated = [...props.modelValue, { id, name }]
  emit('update:modelValue', updated)
  
  // 상태 초기화
  searchQuery.value = ''
  searchResults.value = []
  isFocused.value = false
}

const removeArtist = (index) => {
  const updated = [...props.modelValue]
  updated.splice(index, 1)
  emit('update:modelValue', updated)
}

const handleBlur = () => {
  setTimeout(() => {
    isFocused.value = false
  }, 200)
}
</script>

<template>
  <div class="space-y-6 animate-in fade-in duration-300 relative h-full">
    
    <div class="bg-primary/5 border border-primary/20 p-4 rounded-xl flex items-center gap-4 mb-4">
      <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Users class="w-5 h-5 text-primary" />
      </div>
      <div>
        <p class="text-xs font-bold text-primary tracking-tight">앨범 아티스트 관리</p>
        <p class="text-[10px] text-muted-foreground mt-0.5">합작 앨범이나 컴필레이션 앨범의 경우, 이 앨범을 소유/발행한 주체(예: 다수 아티스트, 제작사)를 모두 추가해 주세요.</p>
      </div>
    </div>

    <div class="bg-muted/30 p-4 rounded-xl border relative z-20">
      <label class="text-xs font-bold text-muted-foreground uppercase block mb-2">앨범 아티스트 검색 및 추가</label>
      <div class="relative">
        <div class="flex items-center gap-2">
          <div class="relative flex-1">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              v-model="searchQuery" 
              placeholder="아티스트 이름을 검색하세요" 
              class="bg-background pl-9 font-medium"
              @input="handleSearch"
              @focus="isFocused = true"
              @blur="handleBlur"
              @keyup.enter="addArtist(searchQuery)"
            />
          </div>
          <Button @click="addArtist(searchQuery)" variant="default" class="shrink-0 font-bold" :disabled="!searchQuery.trim()">
            <UserPlus class="w-4 h-4 mr-2" /> 신규 추가
          </Button>
        </div>

        <div v-if="isFocused && searchQuery.trim()" class="absolute top-full left-0 right-[100px] mt-1 bg-card border rounded-md shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
          
          <div v-if="searchResults.length > 0">
            <button 
              v-for="res in searchResults" 
              :key="res.id"
              @click.stop="addArtist(res)"
              class="w-full text-left px-4 py-2 text-sm hover:bg-muted flex items-center justify-between group transition-colors"
            >
              <span class="font-bold">{{ res.name }}</span>
              <span class="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                기존 라이브러리 연동
              </span>
            </button>
          </div>
          
          <div v-if="!searchResults.some(r => r.name.toLowerCase() === searchQuery.trim().toLowerCase())" class="border-t bg-muted/30">
            <button 
              @click.stop="addArtist(searchQuery)"
              class="w-full text-left px-4 py-3 text-sm text-primary font-medium hover:bg-muted/80 flex items-center gap-2"
            >
              <UserPlus class="w-4 h-4" /> "{{ searchQuery }}" (으)로 새 아티스트 생성
            </button>
          </div>
          
        </div>
      </div>
    </div>

    <div class="space-y-3 relative z-10 pb-8">
      <div v-if="modelValue.length === 0" class="p-8 text-center text-muted-foreground border-2 border-dashed rounded-xl bg-muted/5">
        지정된 앨범 아티스트가 없습니다. 위에서 검색하여 추가해주세요.
      </div>
      
      <TransitionGroup name="list" tag="div" class="space-y-2">
        <div 
          v-for="(artist, index) in modelValue" 
          :key="artist.name + index"
          class="bg-card border rounded-xl p-3 shadow-sm flex items-center justify-between transition-all hover:border-primary/50 group"
        >
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center text-primary">
              <User class="w-5 h-5" />
            </div>
            <div>
              <span class="font-bold text-base block">{{ artist.name }}</span>
              <span v-if="artist.id" class="text-[10px] bg-muted px-2 py-0.5 rounded text-muted-foreground font-mono inline-block mt-1">DB ID: {{ artist.id }}</span>
              <span v-else class="text-[10px] bg-green-500/10 text-green-600 px-2 py-0.5 rounded font-bold inline-block mt-1">신규 아티스트</span>
            </div>
          </div>
          
          <Button variant="ghost" size="icon" @click="removeArtist(index)" class="text-muted-foreground opacity-50 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-500 transition-all">
            <Trash2 class="w-5 h-5" />
          </Button>
        </div>
      </TransitionGroup>
    </div>

  </div>
</template>

<style scoped>
.list-enter-active, .list-leave-active { transition: all 0.3s ease; }
.list-enter-from, .list-leave-to { opacity: 0; transform: translateX(-20px); }
</style>