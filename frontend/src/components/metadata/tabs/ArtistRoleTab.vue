<script setup>
import { ref, onMounted } from 'vue'
import { UserPlus, Trash2, User, Mic, Search } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLibraryStore } from '@/stores/library'
import { notify } from '@/lib/notify'

// 💉 1. shadcn-vue ToggleGroup 임포트
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

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

const ROLE_MAP = [
  { value: 1, label: '가창/연주' },
  { value: 2, label: '작사' },
  { value: 4, label: '작곡' },
  { value: 8, label: '편곡' },
  { value: 16, label: '피처링' },
  { value: 32, label: '제작' }
]

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
    notify.warning('이미 추가된 아티스트입니다.')
    searchQuery.value = ''
    searchResults.value = []
    return
  }

  // 배열에 추가 후 부모에게 emit
  const updated = [...props.modelValue, { id, name, role_mask: 1 }]
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

// 💡 비트마스크(정수) -> 배열(String) 변환 (ToggleGroup 표시용)
const getActiveRoles = (mask) => {
  return ROLE_MAP.filter(r => (mask & r.value) === r.value).map(r => String(r.value))
}

// 💡 배열(String) -> 비트마스크(정수) 변환 (DB 저장용)
const updateRoles = (artist, newRolesArray) => {
  if (!newRolesArray || newRolesArray.length === 0) {
    artist.role_mask = 1 // 최소 1개(가창)는 유지
  } else {
    // 선택된 값들을 비트 OR 연산으로 합칩니다.
    artist.role_mask = newRolesArray.reduce((acc, val) => acc | parseInt(val, 10), 0)
  }
  emit('update:modelValue', [...props.modelValue])
}

const handleBlur = () => {
  // 전역 함수인 setTimeout을 안전하게 호출
  setTimeout(() => {
    isFocused.value = false
  }, 200)
}
</script>

<template>
  <div class="space-y-6 animate-in fade-in duration-300 relative h-full">
    
    <div class="bg-muted/30 p-4 rounded-xl border relative z-20">
      <label class="text-xs font-bold text-muted-foreground uppercase block mb-2">아티스트 검색 및 추가</label>
      <div class="relative">
        <div class="flex items-center gap-2">
          <div class="relative flex-1">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              v-model="searchQuery" 
              placeholder="아티스트 이름을 검색하세요" 
              class="bg-background pl-9"
              @input="handleSearch"
              @focus="isFocused = true"
              @blur="handleBlur"
              @keyup.enter="addArtist(searchQuery)"
            />
          </div>
          <Button @click="addArtist(searchQuery)" variant="default" class="shrink-0 font-bold" :disabled="!searchQuery.trim()">
            <UserPlus class="w-4 h-4 mr-2" /> 신규 생성
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
      <div v-if="modelValue.length === 0" class="p-8 text-center text-muted-foreground border-2 border-dashed rounded-xl">
        참여한 아티스트가 없습니다. 위에서 검색하여 추가해주세요.
      </div>
      
      <TransitionGroup name="list" tag="div" class="space-y-3">
        <div 
          v-for="(artist, index) in modelValue" 
          :key="artist.name + index"
          class="bg-card border rounded-xl p-4 shadow-sm flex flex-col gap-4 transition-all hover:border-primary/50"
        >
          <div class="flex items-center justify-between border-b pb-2">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Mic class="w-4 h-4" v-if="(artist.role_mask & 1) === 1 || (artist.role_mask & 16) === 16" />
                <User class="w-4 h-4" v-else />
              </div>
              <span class="font-bold text-lg">{{ artist.name }}</span>
              <span v-if="artist.id" class="text-[10px] bg-muted px-2 py-0.5 rounded text-muted-foreground font-mono">DB 연동됨</span>
              <span v-else class="text-[10px] bg-green-500/10 text-green-600 px-2 py-0.5 rounded font-bold">신규 생성</span>
            </div>
            
            <Button variant="ghost" size="icon" @click="removeArtist(index)" class="text-red-500 hover:bg-red-500/10 hover:text-red-600">
              <Trash2 class="w-4 h-4" />
            </Button>
          </div>

          <div class="flex flex-col gap-2">
            <p class="text-[10px] font-bold text-muted-foreground uppercase">담당 역할 선택 (다중 선택 가능)</p>
            <div class="flex items-center justify-between">
              
              <ToggleGroup 
                type="multiple" 
                variant="outline"
                :model-value="getActiveRoles(artist.role_mask)"
                @update:model-value="(newVals) => updateRoles(artist, newVals)"
                class="justify-start flex-wrap gap-1"
              >
                <ToggleGroupItem 
                  v-for="role in ROLE_MAP" 
                  :key="role.value" 
                  :value="String(role.value)"
                  class="text-xs h-8 px-3 font-bold data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary"
                >
                  {{ role.label }}
                </ToggleGroupItem>
              </ToggleGroup>

              <span class="text-[10px] text-muted-foreground font-mono bg-muted px-2 py-1 rounded ml-4 shrink-0">
                MASK: {{ artist.role_mask }}
              </span>
              
            </div>
          </div>

        </div>
      </TransitionGroup>
    </div>

  </div>
</template>

<style scoped>
.list-enter-active, .list-leave-active { transition: all 0.3s ease; }
.list-enter-from, .list-leave-to { opacity: 0; transform: translateX(-20px); }
</style>