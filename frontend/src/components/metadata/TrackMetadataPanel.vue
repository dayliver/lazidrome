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
  albumYear: null,
  volume_pct: 100,
  tags: [],
  genre: '',
  albumName: '',
  albumId: '',
  albumArtistName: '',
  artists: [],
  mbid: '',
  newCoverFile: null,
  newCoverUrl: null
})

watch(() => props.item, (newItem) => {
  if (newItem?.local) {
    let parsedTags = []
    const rawTags = newItem.local.tags
    if (Array.isArray(rawTags)) {
      parsedTags = rawTags
    } else if (typeof rawTags === 'string' && rawTags.trim()) {
      try {
        const parsed = JSON.parse(rawTags)
        parsedTags = Array.isArray(parsed) ? parsed : []
      } catch {
        parsedTags = []
      }
    }
    const vol = Number(newItem.local.volume_pct)
    localData.value = {
      title: newItem.local.title || newItem.local.name || '',
      year: newItem.local.year ?? '',
      albumYear: newItem.local.albumYear ?? null,
      volume_pct: Number.isFinite(vol) ? Math.min(150, Math.max(50, Math.round(vol))) : 100,
      tags: parsedTags,
      genre: newItem.local.genre || '',
      albumName: newItem.local.albumName || '',
      albumId: newItem.local.currentAlbumId || '',
      albumArtistName: '',
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