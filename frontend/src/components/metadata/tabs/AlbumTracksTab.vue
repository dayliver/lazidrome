<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { Search, Plus, Trash2, Disc, Star } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { useLibraryStore } from '@/stores/library'
import { useAuthStore } from '@/stores/auth' // 💡 추가
import { getCoverUrl } from '@/lib/image'    // 💡 추가
import SafeImage from '@/components/shared/SafeImage.vue' // 💡 추가
const { t } = useI18n()

const props = defineProps({
  modelValue: { type: Object, required: true },
  item: { type: Object, required: true }
})
const emit = defineEmits(['update:modelValue'])

const library = useLibraryStore()
const auth = useAuthStore() // 💡 추가

const searchQuery = ref('')
const searchResults = ref([])
const isFocused = ref(false)
const isSearching = ref(false)

const hasTrackCover = (track) =>
  !!(track?.custom_cover_type || track?.albumCoverType || props.item?.local?.cover_type)

const getTrackImageUrl = (track) => {
  const id = track?.track_id || track?.id
  if (!id) return ''
  if (track?.custom_cover_type) return auth.coverSrc('track', id)
  if (props.item?.local?.id && (track?.albumCoverType || props.item?.local?.cover_type)) {
    return auth.coverSrc('album', props.item.local.id)
  }
  return ''
}

const updateTracks = (newTracks) => {
  emit('update:modelValue', { ...props.modelValue, albumTracks: newTracks })
}

const handleSearch = async () => {
  const query = searchQuery.value.trim()
  if (!query) {
    searchResults.value = []
    return
  }
  isSearching.value = true
  try {
    searchResults.value = await library.searchTracks(query, 5)
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
  const currentTracks = props.modelValue.albumTracks || []
  if (currentTracks.some(t => t.track_id === track.id)) return
  
  const nextNo = currentTracks.reduce((max, t) => Math.max(max, t.track_number || 0), 0) + 1
  
  const updated = [...currentTracks, {
    track_id: track.id,
    title: track.title,
    artist: track.artist,
    disc_number: 1,
    track_number: nextNo,
    is_primary: 1,
    custom_cover_type: track.custom_cover_type, // 💡 커버 메타데이터도 함께 복사
    albumCoverType: track.albumCoverType
  }]
  
  updateTracks(updated)
  searchQuery.value = ''
  searchResults.value = []
  isFocused.value = false
}

const removeTrack = (index) => {
  const currentTracks = props.modelValue.albumTracks || []
  const updated = [...currentTracks]
  updated.splice(index, 1)
  updateTracks(updated)
}

const togglePrimary = (track) => {
  track.is_primary = track.is_primary === 1 ? 0 : 1
  updateTracks([...(props.modelValue.albumTracks || [])])
}

const triggerUpdate = () => {
  updateTracks([...(props.modelValue.albumTracks || [])])
}

const sortedTracks = computed(() => {
  const tracks = props.modelValue.albumTracks || []
  return [...tracks].sort((a, b) => {
    if (a.disc_number !== b.disc_number) return (a.disc_number || 1) - (b.disc_number || 1)
    return (a.track_number || 0) - (b.track_number || 0)
  })
})
</script>

<template>
  <div class="space-y-6 animate-in fade-in duration-300 relative h-full">
    
    <div class="bg-muted/30 p-4 rounded-xl border relative z-20">
      <label class="text-xs font-bold text-muted-foreground uppercase block mb-2">{{ t('metadata.tracksSearchAdd') }}</label>
      <div class="relative">
        <div class="flex items-center gap-2">
          <div class="relative flex-1">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              v-model="searchQuery" 
              :placeholder="t('metadata.tracksSearchPlaceholder')" 
              class="bg-background pl-9 font-medium"
              @input="handleSearch"
              @focus="isFocused = true"
              @blur="handleBlur"
            />
          </div>
        </div>

        <div v-if="isFocused && searchQuery.trim() && searchResults.length > 0" 
             class="absolute top-full left-0 right-0 mt-1 bg-card border rounded-md shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
          <button 
            v-for="res in searchResults" 
            :key="res.id"
            @click.stop="addTrack(res)"
            class="w-full text-left px-4 py-3 text-sm hover:bg-muted flex items-center justify-between group transition-colors border-b last:border-none"
          >
            <div class="shrink-0 relative w-8 h-8 rounded-md overflow-hidden bg-secondary border flex items-center justify-center mr-3">
              <Disc class="w-4 h-4 opacity-20 absolute" />
              <SafeImage
                v-if="hasTrackCover(res)"
                :src="getTrackImageUrl(res)"
                type="track"
                class="w-full h-full object-cover relative z-10"
              />
            </div>

            <div class="flex flex-col min-w-0 flex-1 pr-4">
              <span class="font-bold truncate">{{ res.title }}</span>
              <span class="text-xs text-muted-foreground truncate">{{ res.artist || t('common.unknownArtist') }}</span>
            </div>
            <div class="shrink-0 flex items-center gap-3">
              <span class="text-[10px] text-muted-foreground font-mono bg-background px-2 py-1 rounded border">{{ res.year || '-' }}</span>
              <Button size="icon" variant="ghost" class="w-6 h-6 rounded-full group-hover:bg-primary group-hover:text-primary-foreground pointer-events-none">
                <Plus class="w-4 h-4" />
              </Button>
            </div>
          </button>
        </div>
        <div v-else-if="isFocused && searchQuery.trim() && searchResults.length === 0"
             class="absolute top-full left-0 right-0 mt-1 bg-card border rounded-md shadow-xl p-4 text-center text-sm text-muted-foreground">
          {{ t('metadata.tracksNoResults') }}
        </div>
      </div>
    </div>

    <div class="space-y-2 relative z-10 pb-8">
      
      <div class="flex items-center justify-between px-2 mb-4">
        <span class="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{{ t('metadata.tracksList', { count: (modelValue.albumTracks || []).length }) }}</span>
        <span class="text-[10px] font-bold text-muted-foreground">{{ t('metadata.tracksListHint') }}</span>
      </div>

      <div v-if="!(modelValue.albumTracks || []).length" class="p-10 text-center text-muted-foreground border-2 border-dashed rounded-xl bg-muted/5">
        <Disc class="w-10 h-10 mx-auto mb-3 opacity-20" />
        {{ t('metadata.tracksEmpty') }}
      </div>
      
      <TransitionGroup name="list" tag="div" class="space-y-2">
        <div 
          v-for="(track, index) in sortedTracks" 
          :key="track.track_id"
          class="flex items-center gap-4 bg-card border rounded-xl p-3 shadow-sm hover:border-primary/40 transition-colors group"
        >
          <div class="flex gap-2 w-[110px] shrink-0">
            <div class="space-y-1">
              <label class="text-[8px] font-black uppercase text-muted-foreground block text-center">{{ t('metadata.discNumber') }}</label>
              <Input type="number" v-model="track.disc_number" @change="triggerUpdate" class="h-8 text-xs text-center font-mono font-bold bg-muted/50 focus:bg-background" />
            </div>
            <div class="space-y-1">
              <label class="text-[8px] font-black uppercase text-muted-foreground block text-center">{{ t('metadata.trackNumber') }}</label>
              <Input type="number" v-model="track.track_number" @change="triggerUpdate" class="h-8 text-xs text-center font-mono font-bold bg-muted/50 focus:bg-background" />
            </div>
          </div>

          <div class="shrink-0 relative w-10 h-10 rounded-md overflow-hidden bg-secondary border flex items-center justify-center">
            <Disc class="w-5 h-5 opacity-20 absolute" />
            <SafeImage
              v-if="hasTrackCover(track)"
              :src="getTrackImageUrl(track)"
              type="track"
              class="w-full h-full object-cover relative z-10"
            />
          </div>

          <div class="flex-1 min-w-0 flex flex-col justify-center">
            <span class="font-bold text-sm truncate">{{ track.title }}</span>
            <span class="text-xs text-muted-foreground truncate">{{ track.artist || t('common.unknownArtist') }}</span>
          </div>

          <div class="flex items-center gap-1 shrink-0">
            <button 
              @click="togglePrimary(track)" 
              class="flex flex-col items-center justify-center w-12 h-12 rounded-lg hover:bg-muted transition-colors focus:outline-none"
              :title="track.is_primary ? t('metadata.primaryAlbum') : t('metadata.setPrimaryAlbum')"
            >
              <Star class="w-4 h-4 transition-all" :class="track.is_primary ? 'fill-yellow-500 text-yellow-500 scale-110' : 'text-muted-foreground'" />
              <span class="text-[8px] font-bold uppercase mt-1" :class="track.is_primary ? 'text-yellow-600' : 'text-muted-foreground'">
                {{ track.is_primary ? t('metadata.primaryShort') : t('metadata.subShort') }}
              </span>
            </button>

            <Button variant="ghost" size="icon" @click="removeTrack(index)" class="text-muted-foreground hover:bg-red-500/10 hover:text-red-500 ml-2">
              <Trash2 class="w-4 h-4" />
            </Button>
          </div>
          
        </div>
      </TransitionGroup>
    </div>

  </div>
</template>

<style scoped>
.list-enter-active, .list-leave-active { transition: all 0.3s ease; }
.list-enter-from, .list-leave-to { opacity: 0; transform: translateX(-10px); }

input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type="number"] {
  -moz-appearance: textfield;
}
</style>