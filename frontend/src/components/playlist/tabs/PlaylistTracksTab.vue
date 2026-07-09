<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLibraryStore } from '@/stores/library'
import { useAuthStore } from '@/stores/auth' // 💡 추가: 이미지 인증용
import { getCoverUrl } from '@/lib/image'    // 💡 추가: 커버 URL 생성기
import SafeImage from '@/components/shared/SafeImage.vue' // 💡 추가: 에러 방지 이미지 컴포넌트

import { Search, Plus, Trash2, GripVertical, ListMusic, Disc } from 'lucide-vue-next' // 💡 Disc 아이콘 추가
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { VueDraggable } from 'vue-draggable-plus'
const { t } = useI18n()

const props = defineProps({
  modelValue: { type: Array, required: true, default: () => [] }
})
const emit = defineEmits(['update:modelValue'])

const library = useLibraryStore()
const auth = useAuthStore() // 💡 추가

const searchQuery = ref('')
const searchResults = ref([])
const isFocused = ref(false)
const isSearching = ref(false)

const localTracks = ref([...props.modelValue])

const getTrackImageUrl = (id) => auth.coverSrc('track', id)

watch(() => props.modelValue, (newVal) => {
  localTracks.value = [...newVal]
})

const updateParent = () => {
  emit('update:modelValue', [...localTracks.value])
}

const handleSearch = async () => {
  const query = searchQuery.value.trim()
  if (!query) {
    searchResults.value = []
    return
  }
  isSearching.value = true
  try {
    searchResults.value = await library.searchTracks(query, 8)
  } catch (e) {
    console.error('트랙 검색 실패:', e)
    searchResults.value = []
  } finally {
    isSearching.value = false
  }
}

const handleBlur = () => {
  setTimeout(() => { isFocused.value = false }, 200)
}

const addTrack = (track) => {
  const newTrack = {
    ...track,
    playlist_track_temp_id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }
  localTracks.value.push(newTrack)
  updateParent()
  searchQuery.value = ''
  searchResults.value = []
  isFocused.value = false
}

const removeTrack = (index) => {
  localTracks.value.splice(index, 1)
  updateParent()
}

const onDragEnd = () => updateParent()
</script>

<template>
  <div class="space-y-6 animate-in fade-in duration-500 relative h-full">
    
    <div class="bg-muted/30 p-6 rounded-2xl border-2 relative z-20">
      <label class="text-xs font-black text-muted-foreground uppercase tracking-widest block mb-3 ml-1">{{ t('metadata.tracksSearchAdd') }}</label>
      <div class="relative">
        <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input 
          v-model="searchQuery" 
          :placeholder="t('playlist.tracksSearchPlaceholder')" 
          class="bg-background pl-12 font-bold h-14 text-base border-2 rounded-xl focus-visible:ring-primary shadow-sm"
          @input="handleSearch"
          @focus="isFocused = true"
          @blur="handleBlur"
        />

        <div v-if="isFocused && searchQuery.trim() && searchResults.length > 0" 
             class="absolute top-[calc(100%+8px)] left-0 right-0 bg-card border-2 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
          <button 
            v-for="res in searchResults" :key="res.id"
            @click.stop="addTrack(res)"
            class="w-full text-left px-4 py-3 text-sm hover:bg-muted/80 flex items-center justify-between group transition-colors border-b last:border-none focus:bg-muted outline-none"
          >
            <div class="shrink-0 relative w-10 h-10 rounded-md overflow-hidden bg-secondary border flex items-center justify-center mr-3">
              <Disc class="w-5 h-5 opacity-20 absolute" />
              <SafeImage v-if="res.custom_cover_type || res.albumCoverType" :src="getTrackImageUrl(res.id)" type="track" class="w-full h-full object-cover relative z-10" />
            </div>

            <div class="flex flex-col min-w-0 flex-1 pr-4 gap-0.5">
              <span class="font-bold text-base truncate">{{ res.title }}</span>
              <span class="text-xs text-muted-foreground font-medium truncate">{{ res.artist || t('common.unknownArtist') }}</span>
            </div>
            <Button size="icon" variant="ghost" class="shrink-0 w-8 h-8 rounded-full group-hover:bg-primary group-hover:text-primary-foreground pointer-events-none transition-transform group-hover:scale-110">
              <Plus class="w-4 h-4" />
            </Button>
          </button>
        </div>
        <div v-else-if="isFocused && searchQuery.trim() && searchResults.length === 0"
             class="absolute top-[calc(100%+8px)] left-0 right-0 bg-card border-2 rounded-xl shadow-xl p-8 text-center text-sm font-bold text-muted-foreground">
          {{ t('playlist.noSearchTracks') }}
        </div>
      </div>
    </div>

    <div class="space-y-4 relative z-10 pb-8">
      
      <div class="flex items-end justify-between px-2 mb-2 border-b-2 pb-3">
        <span class="text-xs font-black text-foreground uppercase tracking-widest">
          {{ t('playlist.currentTracks', { count: localTracks.length }) }}
        </span>
        <span class="text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-muted/50 px-2 py-1 rounded-md">
          {{ t('playlist.dragReorder') }}
        </span>
      </div>

      <div v-if="localTracks.length === 0" class="p-14 text-center text-muted-foreground border-2 border-dashed rounded-2xl bg-muted/5">
        <ListMusic class="w-12 h-12 mx-auto mb-4 opacity-20" />
        <h3 class="text-lg font-black text-foreground mb-1">{{ t('metadata.playlistTracksEmptyTitle') }}</h3>
        <p class="text-sm font-medium">{{ t('metadata.playlistTracksEmpty') }}</p>
      </div>
      
      <VueDraggable
        v-model="localTracks"
        class="space-y-2.5"
        handle=".drag-handle"
        :animation="200"
        @end="onDragEnd"
      >
        <div 
          v-for="(track, index) in localTracks" 
          :key="track.playlist_track_temp_id || track.playlist_track_id || index"
          class="flex items-center gap-4 bg-card border-2 rounded-xl p-3 shadow-sm hover:border-primary/50 transition-colors group"
        >
          <div class="shrink-0 flex items-center pr-2 pl-1 cursor-grab active:cursor-grabbing drag-handle text-muted-foreground/30 hover:text-foreground transition-colors">
            <GripVertical class="w-5 h-5" />
          </div>

          <div class="w-6 text-center font-mono text-sm font-black text-muted-foreground">
            {{ index + 1 }}
          </div>

          <div class="shrink-0 relative w-12 h-12 rounded-md overflow-hidden bg-secondary border flex items-center justify-center">
            <Disc class="w-6 h-6 opacity-20 absolute" />
            <SafeImage v-if="track.custom_cover_type || track.albumCoverType" :src="getTrackImageUrl(track.id)" type="track" class="w-full h-full object-cover relative z-10" />
          </div>

          <div class="flex-1 min-w-0 flex flex-col justify-center">
            <span class="font-bold text-base truncate">{{ track.title }}</span>
            <span class="text-xs text-muted-foreground font-medium truncate">{{ track.artist || t('common.unknownArtist') }}</span>
          </div>

          <Button variant="ghost" size="icon" @click="removeTrack(index)" class="text-muted-foreground hover:bg-red-500/10 hover:text-red-500 shrink-0">
            <Trash2 class="w-4 h-4" />
          </Button>
        </div>
      </VueDraggable>
    </div>

  </div>
</template>

<style scoped>
.sortable-ghost { opacity: 0.4; background: hsl(var(--muted)); border-style: dashed; }
.sortable-drag { cursor: grabbing !important; box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1); }
</style>