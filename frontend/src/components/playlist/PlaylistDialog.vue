<script setup>
import { ref, computed, watch } from 'vue'
import { usePlaylistStore } from '@/stores/playlist'
import { Button } from '@/components/ui/button'
import { X, Save, Info, ListMusic, ImageIcon } from 'lucide-vue-next'

// 탭 컴포넌트 임포트 (곧 생성할 예정)
import PlaylistBasicInfoTab from './tabs/PlaylistBasicInfoTab.vue'
import PlaylistTracksTab from './tabs/PlaylistTracksTab.vue'
import CoverArtTab from '@/components/shared/tabs/CoverArtTab.vue' // 💡 shared로 이동 가정

const props = defineProps({
  isOpen: Boolean,
  editTarget: { type: Object, default: null }
})
const emit = defineEmits(['update:isOpen', 'success'])

const playlistStore = usePlaylistStore()
const activeTab = ref('basic')
const isSubmitting = ref(false)

// 💡 EnrichmentAlbum 스타일의 통합 데이터 구조
const localData = ref({
  name: '',
  description: '',
  type: 'list',
  rules: { match: 'all', conditions: [], sortBy: 'random', limit: 50 },
  playlistTracks: [], // 수동 리스트용 곡 목록
  newCoverFile: null,
  newCoverUrl: null
})

// 초기화 로직 (생성 vs 수정)
watch(() => props.isOpen, (open) => {
  if (open) {
    activeTab.value = 'basic'
    if (props.editTarget) {
      localData.value = {
        ...props.editTarget,
        rules: props.editTarget.rules || { match: 'all', conditions: [], sortBy: 'random', limit: 50 },
        playlistTracks: props.editTarget.tracks || [],
        newCoverFile: null,
        newCoverUrl: null
      }
    } else {
      localData.value = {
        name: '', description: '', type: 'list',
        rules: { match: 'all', conditions: [], sortBy: 'random', limit: 50 },
        playlistTracks: [],
        newCoverFile: null,
        newCoverUrl: null
      }
    }
  }
})

// 💡 스마트 믹스는 곡을 수동으로 관리하지 않으므로 탭에서 제외합니다.
const tabs = computed(() => {
  const base = [{ id: 'basic', label: '기본 정보', icon: Info }]
  if (localData.value.type === 'list') {
    base.push({ id: 'tracks', label: '수록곡 관리', icon: ListMusic })
  }
  base.push({ id: 'cover', label: '커버 아트', icon: ImageIcon })
  return base
})

const handleSave = async () => {
  isSubmitting.value = true
  try {
    let result;
    if (props.editTarget) {
      result = await playlistStore.updatePlaylist(props.editTarget.id, localData.value)
    } else {
      result = await playlistStore.createPlaylist(localData.value)
    }

    if (result) {
      emit('success')
      emit('update:isOpen', false)
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
    <div class="bg-card w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl border-2 flex flex-col overflow-hidden">
      
      <header class="flex items-center justify-between px-8 py-5 border-b bg-muted/20">
        <h2 class="text-2xl font-black">{{ editTarget ? '플레이리스트 편집' : '새 플레이리스트' }}</h2>
        <Button variant="ghost" size="icon" @click="emit('update:isOpen', false)"><X /></Button>
      </header>

      <nav class="flex items-center border-b px-8 gap-8 bg-muted/5 shrink-0 overflow-x-auto no-scrollbar">
        <button 
          v-for="tab in tabs" :key="tab.id"
          @click="activeTab = tab.id" 
          class="flex items-center gap-2 py-4 text-sm font-black border-b-2 transition-all whitespace-nowrap focus:outline-none"
          :class="activeTab === tab.id ? 'border-primary text-primary translate-y-[1px]' : 'border-transparent text-muted-foreground hover:text-foreground'"
        >
          <component :is="tab.icon" class="w-4 h-4" />
          {{ tab.label }}
        </button>
      </nav>

      <main class="flex-1 overflow-y-auto p-8 relative custom-scrollbar">
        <div v-show="activeTab === 'basic'">
          <PlaylistBasicInfoTab v-model="localData" :is-edit="!!editTarget" />
        </div>
        <div v-show="activeTab === 'tracks'">
          <PlaylistTracksTab v-model="localData.playlistTracks" />
        </div>
        <div v-show="activeTab === 'cover'">
          <CoverArtTab v-model="localData" />
        </div>
      </main>

      <footer class="p-6 border-t bg-muted/20 flex justify-end gap-3">
        <Button variant="ghost" @click="emit('update:isOpen', false)" class="font-bold">취소</Button>
        <Button @click="handleSave" :disabled="isSubmitting" class="font-black px-12 shadow-lg">
          <span v-if="isSubmitting" class="mr-2 h-4 w-4 animate-spin border-2 border-current border-t-transparent rounded-full"></span>
          <Save class="w-4 h-4 mr-2" /> 저장하기
        </Button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar { display: none; }
.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: hsl(var(--muted)); border-radius: 10px; }
</style>