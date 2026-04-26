<script setup>
import { ref, watch } from 'vue'

// 💡 모든 탭 컴포넌트를 빠짐없이 Import 합니다.
import AlbumBasicInfoTab from './tabs/AlbumBasicInfoTab.vue'
import AlbumArtistsTab from './tabs/AlbumArtistsTab.vue'
import AlbumTracksTab from './tabs/AlbumTracksTab.vue'
import CoverArtTab from '../shared/tabs/CoverArtTab.vue'
import ExternalAlbumTab from './tabs/ExternalAlbumTab.vue'

const props = defineProps(['item', 'activeTab'])
const emit = defineEmits(['update:activeTab'])

// 💡 스키마 v2.1 반영: tags 배열 추가
const localData = ref({
  title: '',
  year: '',
  tags: [], // <-- 추가됨!
  albumArtists: [],
  albumTracks: [],
  mbid: '',
  newCoverFile: null,
  newCoverUrl: null
})

// 초기 데이터 바인딩
watch(() => props.item, (newItem) => {
  if (newItem?.local) {
    localData.value = {
      title: newItem.local.name || '',
      year: newItem.local.year || '',
      tags: newItem.local.tags || [], // <-- 추가됨!
      albumArtists: newItem.local.albumArtists || [],
      albumTracks: newItem.local.tracks || [],
      mbid: newItem.local.mbid || '',
      newCoverFile: null,
      newCoverUrl: null
    }
  }
}, { immediate: true })

// 다이얼로그(부모)가 호출할 "페이로드 조립" 함수를 공개합니다.
const getPayload = () => localData.value
defineExpose({ getPayload })
</script>

<template>
  <div class="h-full">
    
    <div v-show="activeTab === 'basic'">
      <AlbumBasicInfoTab 
        v-model="localData" 
        :item="item" 
        @request-tab-change="$emit('update:activeTab', $event)" 
      />
    </div>
    
    <div v-show="activeTab === 'albumArtists'">
      <AlbumArtistsTab v-model="localData.albumArtists" />
    </div>
    
    <div v-show="activeTab === 'tracks'">
      <AlbumTracksTab v-model="localData" :item="item" />
    </div>

    <div v-show="activeTab === 'cover'" class="h-full">
      <CoverArtTab v-model="localData" />
    </div>

    <div v-show="activeTab === 'external'" class="h-full">
      <ExternalAlbumTab v-model="localData" :item="item" />
    </div>

  </div>
</template>