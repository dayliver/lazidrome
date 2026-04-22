<script setup>
import { ref, computed, watch } from 'vue'
import { useEnrichmentStore } from '@/stores/enrichment'
import { useLibraryStore } from '@/stores/library'
import { useAuthStore } from '@/stores/auth'

// UI 구성 요소 임포트
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  X, Info, Users, Image as ImageIcon, Globe, 
  Save, ListMusic, LayoutDashboard
} from 'lucide-vue-next'

import TrackBasicInfoTab from '@/components/enrichment/tabs/TrackBasicInfoTab.vue'
import AlbumBasicInfoTab from '@/components/enrichment/tabs/AlbumBasicInfoTab.vue'
import ArtistRoleTab from '@/components/enrichment/tabs/ArtistRoleTab.vue'
import AlbumTracksTab from '@/components/enrichment/tabs/AlbumTracksTab.vue'
import CoverArtTab from '@/components/enrichment/tabs/CoverArtTab.vue'
import ExternalTrackTab from '@/components/enrichment/tabs/ExternalTrackTab.vue'

const enrichment = useEnrichmentStore()
const library = useLibraryStore()
const auth = useAuthStore()

const item = computed(() => enrichment.currentItem)
const activeTab = ref('basic')

// 💡 1. formData에 앨범 전용 속성(mainArtistName, mainArtistId) 추가
const formData = ref({
  title: '',
  year: '',
  tags: [],
  genre: '',
  albumName: '',
  albumId: '',
  albumTracks: [],
  artists: [],
  mainArtistName: '', // 💉 앨범 메인 아티스트 이름
  mainArtistId: '',   // 💉 앨범 메인 아티스트 ID (수동 입력 시 null)
  biography: '',
  mbid: '',
  newCoverFile: null, 
  newCoverUrl: null   
})

// 💡 2. 데이터 초기화 시 앨범 데이터 바인딩
watch(item, (newItem) => {
  if (newItem && newItem.local) {
    formData.value = {
      title: newItem.local.title || newItem.local.name || '',
      year: newItem.local.year || '',
      tags: newItem.local.tags ? JSON.parse(newItem.local.tags) : [],
      genre: newItem.local.genre || '',
      albumName: newItem.type === 'track' ? (newItem.local.albumName || '') : '',
      albumId: newItem.local.currentAlbumId || '',
      albumTracks: newItem.local.tracks || [],
      artists: newItem.local.artists || [],
      // 💉 백엔드(enrichment.js)에서 보내주는 artistName 등을 매핑
      mainArtistName: newItem.local.artistName || '', 
      mainArtistId: newItem.local.main_artist_id || '', 
      biography: newItem.local.bio || '', 
      mbid: newItem.local.mbid || '',
      newCoverFile: null,
      newCoverUrl: null
    }
    activeTab.value = 'basic'
  }
}, { immediate: true })

const closeDialog = () => enrichment.shiftQueue()

const tabs = computed(() => {
  if (!item.value) return []
  const baseTabs = [{ id: 'basic', label: '기본 정보', icon: Info }]
  if (item.value.type === 'track') baseTabs.push({ id: 'artists', label: '참여 아티스트', icon: Users })
  if (item.value.type === 'album') baseTabs.push({ id: 'tracks', label: '수록곡 관리', icon: ListMusic })
  baseTabs.push({ id: 'cover', label: item.value.type === 'artist' ? '프로필 사진' : '커버 아트', icon: ImageIcon })
  baseTabs.push({ id: 'external', label: '외부 연동', icon: Globe })
  return baseTabs
})

const handleSave = async () => {
  if (!item.value?.local?.id) return
  
  let payload;

  // 💡 3. 저장 시 앨범(Album) 데이터 추출 로직 추가
  if (formData.value.newCoverFile) {
    console.log("📦 파일 직송 준비 중 (Multipart FormData)...");
    payload = new FormData();
    
    payload.append('title', formData.value.title);
    payload.append('tags', JSON.stringify(formData.value.tags));
    payload.append('mbid', formData.value.mbid);
    
    if (item.value.type === 'track') {
      if (formData.value.year) payload.append('year', formData.value.year);
      payload.append('genre', formData.value.genre);
      payload.append('artists', JSON.stringify(formData.value.artists));
      payload.append('albumId', formData.value.albumId);
      payload.append('albumName', formData.value.albumName);
    } 
    // 💉 앨범 페이로드 조립 (Multipart)
    else if (item.value.type === 'album') {
      if (formData.value.year) payload.append('year', formData.value.year);
      payload.append('mainArtistName', formData.value.mainArtistName);
      if (formData.value.mainArtistId) payload.append('mainArtistId', formData.value.mainArtistId);
    }
    
    payload.append('newCoverFile', formData.value.newCoverFile);
  } 
  else {
    payload = {
      title: formData.value.title,
      tags: formData.value.tags,
      mbid: formData.value.mbid
    };
    
    if (item.value.type === 'track') {
      payload.year = formData.value.year ? parseInt(formData.value.year, 10) : null;
      payload.genre = formData.value.genre;
      payload.artists = formData.value.artists;
      payload.albumId = formData.value.albumId;
      payload.albumName = formData.value.albumName;
    } 
    // 💉 앨범 페이로드 조립 (JSON)
    else if (item.value.type === 'album') {
      payload.year = formData.value.year ? parseInt(formData.value.year, 10) : null;
      payload.mainArtistName = formData.value.mainArtistName;
      payload.mainArtistId = formData.value.mainArtistId;
    }

    if (formData.value.newCoverUrl) {
      payload.newCoverUrl = formData.value.newCoverUrl;
    }
  }

  try {
    const success = await enrichment.updateMetadata(item.value.type, item.value.local.id, payload);
    
    if (success) {
      // 앨범이나 트랙 모두 라이브러리를 새로고침하여 갱신합니다.
      await library.getTracks(true);
      await library.getAlbums(); 
      console.log("🎉 라이브러리 갱신 완료");
    }
  } catch (err) {
    console.error("❌ 저장 프로세스 중단:", err);
  }
}
</script>

<template>
  <div v-if="item" class="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
    
    <div class="bg-card w-full max-w-5xl h-[85vh] min-h-[650px] rounded-2xl shadow-2xl border-2 flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
      
      <header class="flex items-center justify-between px-8 py-5 border-b bg-muted/20 shrink-0">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner">
            <LayoutDashboard v-if="item.type === 'track'" class="w-6 h-6 text-primary" />
            <ImageIcon v-else-if="item.type === 'album'" class="w-6 h-6 text-primary" />
            <Users v-else class="w-6 h-6 text-primary" />
          </div>
          <div>
            <div class="flex items-center gap-2 mb-0.5">
              <span class="px-2 py-0.5 bg-primary text-primary-foreground text-[10px] font-black rounded-md uppercase tracking-tighter">
                {{ item.type }}
              </span>
              <span class="text-[10px] font-bold text-muted-foreground tabular-nums">ID: {{ item.local.id }}</span>
            </div>
            <h2 class="text-2xl font-black tracking-tight truncate max-w-md">
              {{ formData.title || '이름 없음' }}
            </h2>
          </div>
        </div>
        
        <div class="flex items-center gap-2">
          <div v-if="enrichment.isFetching" class="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-full text-[11px] font-bold animate-pulse">
            <span class="w-2 h-2 bg-primary rounded-full animate-bounce"></span>
            Syncing...
          </div>
          <Button variant="ghost" size="icon" @click="closeDialog" class="rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors">
            <X class="w-6 h-6" />
          </Button>
        </div>
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

      <main class="flex-1 overflow-y-auto p-8 bg-background/50 relative custom-scrollbar">
        
        <div v-show="activeTab === 'basic'" class="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <TrackBasicInfoTab 
            v-if="item.type === 'track'" 
            v-model="formData" 
            :item="item" 
            @request-tab-change="(tabId) => activeTab = tabId" 
          />
          <AlbumBasicInfoTab 
            v-if="item.type === 'album'" 
            v-model="formData" 
            :item="item" 
            @request-tab-change="(tabId) => activeTab = tabId" 
          />
        </div>

        <div v-if="item.type === 'track'" v-show="activeTab === 'artists'" class="h-full">
          <ArtistRoleTab v-model="formData.artists" />
        </div>

        <div v-if="item.type === 'album'" v-show="activeTab === 'tracks'" class="h-full">
          <AlbumTracksTab 
            v-if="item.type === 'album'" 
            v-show="activeTab === 'tracks'" 
            v-model="formData" 
            :item="item" 
          />
        </div>

        <div v-show="activeTab === 'cover'" class="h-full">
          <CoverArtTab v-model="formData" />
        </div>

        <div v-show="activeTab === 'external'" class="h-full">
          <ExternalTrackTab 
            v-model="formData" 
            :item="item" 
          />
        </div>

      </main>

      <footer class="p-6 border-t bg-muted/20 flex items-center justify-between shrink-0 px-8">
        <div class="flex items-center gap-4 text-xs text-muted-foreground font-medium">
          <span class="flex items-center gap-1.5"><Checkbox class="w-3.5 h-3.5 text-green-500" /> 데이터 무결성 체크 완료</span>
        </div>
        <div class="flex items-center gap-3">
          <Button variant="ghost" @click="closeDialog" class="font-bold px-6">닫기</Button>
          <Button @click="handleSave" class="shadow-xl font-black px-12 bg-primary hover:bg-primary/90 text-primary-foreground">
            <Save class="w-4 h-4 mr-2" /> 변경사항 저장
          </Button>
        </div>
      </footer>

    </div>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: hsl(var(--muted)); border-radius: 10px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: hsl(var(--muted-foreground) / 0.4); }
</style>