<script setup>
import { ref, watch } from 'vue'

// 💡 아티스트용 탭 컴포넌트 임포트
import ArtistBasicInfoTab from './tabs/ArtistBasicInfoTab.vue'
import CoverArtTab from './tabs/CoverArtTab.vue'
import ExternalArtistTab from './tabs/ExternalArtistTab.vue'

const props = defineProps(['item', 'activeTab'])
const emit = defineEmits(['update:activeTab'])

// 💡 아티스트에게 필요한 상태 정의
const localData = ref({
  title: '', // 아티스트 이름
  biography: '',
  tags: [],
  mbid: '',
  newCoverFile: null,
  newCoverUrl: null
})

// 초기 데이터 바인딩
watch(() => props.item, (newItem) => {
  if (newItem?.local) {
    let parsedTags = []
    try {
      parsedTags = newItem.local.tags ? JSON.parse(newItem.local.tags) : []
    } catch (e) {
      parsedTags = []
    }

    localData.value = {
      title: newItem.local.name || '',
      biography: newItem.local.bio || '',
      tags: parsedTags,
      mbid: newItem.local.mbid || '',
      newCoverFile: null,
      newCoverUrl: null
    }
  }
}, { immediate: true })

// 💡 스토어로 보낼 순수 데이터 
const getPayload = () => localData.value
defineExpose({ getPayload })
</script>

<template>
  <div class="h-full">
    
    <div v-show="activeTab === 'basic'" class="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <ArtistBasicInfoTab 
        v-model="localData" 
        :item="item" 
        @request-tab-change="$emit('update:activeTab', $event)" 
      />
    </div>

    <div v-show="activeTab === 'cover'" class="h-full">
      <CoverArtTab v-model="localData" />
    </div>

    <div v-show="activeTab === 'external'" class="h-full">
      <ExternalArtistTab v-model="localData" :item="item" />
    </div>

  </div>
</template>