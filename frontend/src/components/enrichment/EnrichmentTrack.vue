<script setup>
import { ref, watch } from 'vue'
import TrackBasicInfoTab from './tabs/TrackBasicInfoTab.vue'
import ArtistRoleTab from './tabs/ArtistRoleTab.vue'
import CoverArtTab from '../shared/tabs/CoverArtTab.vue'
import ExternalTrackTab from './tabs/ExternalTrackTab.vue'

const props = defineProps(['item', 'activeTab'])
const emit = defineEmits(['update:activeTab'])

// 💡 앨범 아티스트 이름을 담을 공간(albumArtistName) 추가
const localData = ref({
  title: '',
  year: '',
  tags: [],
  genre: '',
  albumName: '',
  albumId: '',
  albumArtistName: '', // 💉 추가됨
  artists: [],
  mbid: '',
  newCoverFile: null,
  newCoverUrl: null
})

watch(() => props.item, (newItem) => {
  if (newItem?.local) {
    localData.value = {
      title: newItem.local.title || newItem.local.name || '',
      year: newItem.local.year || '',
      tags: newItem.local.tags ? JSON.parse(newItem.local.tags) : [],
      genre: newItem.local.genre || '',
      albumName: newItem.local.albumName || '',
      albumId: newItem.local.currentAlbumId || '',
      albumArtistName: '', // 초기 로드 시에는 비워둠 (선택 시 채워짐)
      artists: newItem.local.artists || [],
      mbid: newItem.local.mbid || '',
      newCoverFile: null,
      newCoverUrl: null
    }
  }
}, { immediate: true })

// 💡 [핵심] 이미지가 있으면 화물(FormData)로 포장하고, 없으면 일반 편지(JSON)로 보냅니다.
const getPayload = () => localData.value
defineExpose({ getPayload })
</script>

<template>
  <div class="h-full">
    <div v-show="activeTab === 'basic'" class="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <TrackBasicInfoTab 
        v-model="localData" 
        :item="item" 
        @request-tab-change="$emit('update:activeTab', $event)" 
      />
    </div>

    <div v-show="activeTab === 'artists'" class="h-full">
      <ArtistRoleTab v-model="localData.artists" />
    </div>

    <div v-show="activeTab === 'cover'" class="h-full">
      <CoverArtTab v-model="localData" />
    </div>

    <div v-show="activeTab === 'external'" class="h-full">
      <ExternalTrackTab v-model="localData" :item="item" />
    </div>
  </div>
</template>