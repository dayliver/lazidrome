<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLibraryStore } from '@/stores/library'
import { useAuthStore } from '@/stores/auth' // 💡 추가: 이미지 인증용
import SafeImage from '@/components/shared/SafeImage.vue' // 💡 추가: 에러 방지 이미지 컴포넌트

import { Search, Plus, Trash2, GripVertical, ListMusic, Disc, ChevronUp, ChevronDown } from 'lucide-vue-next' // 💡 Disc 아이콘 추가
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
const isSearching = ref(false)
let searchRequest = 0

const localTracks = ref([...props.modelValue])

const getTrackImageUrl = (id) => auth.coverSrc('track', id)

watch(() => props.modelValue, (newVal) => {
  localTracks.value = [...newVal]
})

const updateParent = () => {
  emit('update:modelValue', [...localTracks.value])
}

const handleSearch = async () => {
  const request = ++searchRequest
  const query = searchQuery.value.trim()
  searchResults.value = []
  if (!query) {
    isSearching.value = false
    return
  }
  isSearching.value = true
  try {
    const results = await library.searchTracks(query, 8)
    if (request === searchRequest) searchResults.value = results
  } catch (e) {
    console.error('트랙 검색 실패:', e)
  } finally {
    if (request === searchRequest) isSearching.value = false
  }
}

const addTrack = (track) => {
  const newTrack = {
    ...track,
    playlist_track_temp_id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }
  localTracks.value.push(newTrack)
  updateParent()
  searchQuery.value = ''
}

const removeTrack = (index) => {
  localTracks.value.splice(index, 1)
  updateParent()
}

watch(searchQuery, handleSearch)

function moveTrack(index, direction) {
  const target = index + direction
  if (target < 0 || target >= localTracks.value.length) return
  const [track] = localTracks.value.splice(index, 1)
  localTracks.value.splice(target, 0, track)
  updateParent()
}

const onDragEnd = () => updateParent()
</script>

<template>
  <div class="space-y-6 animate-in fade-in duration-500 relative h-full">
    
    <div class="bg-muted/30 p-3 sm:p-6 rounded-2xl border-2 relative z-20">
      <label class="text-xs font-black text-muted-foreground uppercase tracking-widest block mb-3 ml-1">{{ t('metadata.tracksSearchAdd') }}</label>
      <div class="relative">
        <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input 
          v-model="searchQuery" 
          :placeholder="t('playlist.tracksSearchPlaceholder')" 
          class="bg-background pl-12 font-bold h-14 text-base border-2 rounded-xl focus-visible:ring-primary shadow-sm"
          :aria-label="t('metadata.tracksSearchAdd')"
        />

        <div v-if="searchResults.length > 0"
             class="mt-2 bg-card border-2 rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
          <button
            type="button"
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
            <span class="grid size-8 shrink-0 place-items-center rounded-full group-hover:bg-primary group-hover:text-primary-foreground" aria-hidden="true">
              <Plus class="w-4 h-4" />
            </span>
          </button>
        </div>
        <div v-else-if="searchQuery.trim() && !isSearching"
             class="mt-2 bg-card border-2 rounded-xl shadow-xl p-8 text-center text-sm font-bold text-muted-foreground">
          {{ t('playlist.noSearchTracks') }}
        </div>
      </div>
    </div>

    <div class="space-y-4 relative z-10 pb-8">
      
      <div class="flex flex-wrap items-end justify-between gap-2 px-2 mb-2 border-b-2 pb-3">
        <span class="text-xs font-black text-foreground uppercase tracking-widest">
          {{ t('playlist.currentTracks', { count: localTracks.length }) }}
        </span>
        <span class="text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-muted/50 px-2 py-1 rounded-md">
          {{ t('playlist.dragReorder') }}
        </span>
      </div>

      <div v-if="localTracks.length === 0" class="p-6 sm:p-14 text-center text-muted-foreground border-2 border-dashed rounded-2xl bg-muted/5">
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
          class="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-4 bg-card border-2 rounded-xl p-3 shadow-sm hover:border-primary/50 transition-colors group"
        >
          <div class="shrink-0 flex items-center pr-2 pl-1 cursor-grab touch-none active:cursor-grabbing drag-handle text-muted-foreground/30 hover:text-foreground transition-colors">
            <GripVertical class="w-5 h-5" />
          </div>

          <div class="hidden w-6 text-center sm:block font-mono text-sm font-black text-muted-foreground">
            {{ index + 1 }}
          </div>

          <div class="shrink-0 relative w-12 h-12 rounded-md overflow-hidden bg-secondary border flex items-center justify-center">
            <Disc class="w-6 h-6 opacity-20 absolute" />
            <SafeImage v-if="track.custom_cover_type || track.albumCoverType" :src="getTrackImageUrl(track.id)" type="track" class="w-full h-full object-cover relative z-10" />
          </div>

          <div class="min-w-0 flex-1 basis-1/2 flex flex-col justify-center">
            <span class="font-bold text-base truncate">{{ track.title }}</span>
            <span class="text-xs text-muted-foreground font-medium truncate">{{ track.artist || t('common.unknownArtist') }}</span>
          </div>

          <div class="flex w-full justify-end sm:w-auto">
            <Button variant="ghost" size="icon" class="size-11 sm:hidden" :aria-label="t('playlist.moveTrackUp')" :disabled="index === 0" @click="moveTrack(index, -1)">
              <ChevronUp class="size-4" />
            </Button>
            <Button variant="ghost" size="icon" class="size-11 sm:hidden" :aria-label="t('playlist.moveTrackDown')" :disabled="index === localTracks.length - 1" @click="moveTrack(index, 1)">
              <ChevronDown class="size-4" />
            </Button>
            <Button variant="ghost" size="icon" class="size-11 sm:size-9 text-muted-foreground hover:text-destructive" :aria-label="t('common.delete')" @click="removeTrack(index)">
              <Trash2 class="size-4" />
            </Button>
          </div>
        </div>
      </VueDraggable>
    </div>

  </div>
</template>

<style scoped>
.sortable-ghost { opacity: 0.4; background: hsl(var(--muted)); border-style: dashed; }
.sortable-drag { cursor: grabbing !important; box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1); }
</style>