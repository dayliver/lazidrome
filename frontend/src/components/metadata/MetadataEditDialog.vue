<script setup>
import { ref, computed, defineAsyncComponent } from 'vue'
import { useLibraryStore } from '@/stores/library'
import { useMetadataEditStore } from '@/stores/metadataEdit'
import { Button } from '@/components/ui/button'
import { X, Save, Info, Users, Image as ImageIcon, Globe, ListMusic } from 'lucide-vue-next'

const TrackMetadataPanel = defineAsyncComponent(() => import('./TrackMetadataPanel.vue'))
const AlbumMetadataPanel = defineAsyncComponent(() => import('./AlbumMetadataPanel.vue'))
const ArtistMetadataPanel = defineAsyncComponent(() => import('./ArtistMetadataPanel.vue'))

const library = useLibraryStore()
const metadataEdit = useMetadataEditStore()
const item = computed(() => metadataEdit.currentItem)
const activeTab = ref('basic')
const wrapperRef = ref(null)

const wrapperMap = { track: TrackMetadataPanel, album: AlbumMetadataPanel, artist: ArtistMetadataPanel }
const currentWrapper = computed(() => item.value ? wrapperMap[item.value.type] : null)

// 💡 잃어버렸던 탭 구성 로직 복구
const tabs = computed(() => {
  if (!item.value) return []
  const baseTabs = [{ id: 'basic', label: '기본 정보', icon: Info }]
  
  if (item.value.type === 'track') {
    baseTabs.push({ id: 'artists', label: '참여 아티스트', icon: Users })
  } else if (item.value.type === 'album') {
    baseTabs.push({ id: 'albumArtists', label: '앨범 아티스트', icon: Users }) 
    baseTabs.push({ id: 'tracks', label: '수록곡 관리', icon: ListMusic })
  }
  
  baseTabs.push({ id: 'cover', label: item.value.type === 'artist' ? '프로필 사진' : '커버 아트', icon: ImageIcon })
  baseTabs.push({ id: 'external', label: '외부 연동', icon: Globe })
  return baseTabs
})

const handleSave = async () => {
  const formData = wrapperRef.value?.getPayload()
  if (!formData) return

  // 💡 1. success(true/false) 대신 updatedData(서버의 최신 객체)를 받습니다!
  const updatedData = await metadataEdit.saveMetadata(item.value, formData)
  
  if (updatedData) {
    // 💡 2. 전체 새로고침 대신, 핀셋으로 해당 객체만 싹 갈아끼웁니다 (Local Mutation)
    if (item.value.type === 'artist') {
      library.updateLocalArtist(updatedData)
    } else if (item.value.type === 'album') {
      library.updateLocalAlbum(updatedData)
    } else if (item.value.type === 'track') {
      library.updateLocalTrack(updatedData)
    }
    
    // 💡 3. 갈아끼우기가 끝났으니 모달 창을 닫습니다.
    metadataEdit.shiftQueue()
  }
}
</script>

<template>
  <div v-if="item" class="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
    <div class="bg-card w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl border-2 flex flex-col overflow-hidden">
      
      <header class="flex items-center justify-between px-8 py-5 border-b bg-muted/20">
        <h2 class="text-2xl font-black">메타데이터 편집</h2>
        <Button variant="ghost" size="icon" @click="metadataEdit.shiftQueue()"><X /></Button>
      </header>

      <nav class="flex items-center border-b px-8 gap-8 bg-muted/5 shrink-0 overflow-x-auto no-scrollbar">
        <button 
          v-for="tab in tabs" 
          :key="tab.id"
          @click="activeTab = tab.id" 
          class="flex items-center gap-2 py-4 text-sm font-black border-b-2 transition-all whitespace-nowrap focus:outline-none"
          :class="activeTab === tab.id ? 'border-primary text-primary translate-y-[1px]' : 'border-transparent text-muted-foreground hover:text-foreground'"
        >
          <component :is="tab.icon" class="w-4 h-4" />
          {{ tab.label }}
        </button>
      </nav>

      <main class="flex-1 overflow-y-auto p-8 relative">
        <component 
          :is="currentWrapper" 
          ref="wrapperRef"
          :item="item" 
          :active-tab="activeTab"
          @update:active-tab="activeTab = $event"
        />
      </main>

      <footer class="p-6 border-t bg-muted/20 flex justify-end">
        <Button @click="handleSave" class="font-black px-12">
          <Save class="w-4 h-4 mr-2" /> 변경사항 저장
        </Button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
</style>