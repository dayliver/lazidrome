<script setup>
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search, Calendar, Tag as TagIcon, Check, Image as ImageIcon } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLibraryStore } from '@/stores/library'
import { useAuthStore } from '@/stores/auth'
import { getCoverUrl } from '@/lib/image'

import { 
  TagsInput, TagsInputInput, TagsInputItem, 
  TagsInputItemDelete, TagsInputItemText 
} from '@/components/ui/tags-input'
const { t } = useI18n()

const props = defineProps({
  modelValue: { type: Object, required: true },
  item: { type: Object, required: true }
})
const emit = defineEmits(['update:modelValue'])

const library = useLibraryStore()
const auth = useAuthStore()

const allAlbums = ref([])
const albumSearchResults = ref([])
const isAlbumFocused = ref(false)

onMounted(async () => {
  allAlbums.value = await library.getAlbums()
})

const handleAlbumBlur = () => {
  window.setTimeout(() => {
    isAlbumFocused.value = false
  }, 200)
}

const handleAlbumSearch = () => {
  const query = props.modelValue.albumName.trim().toLowerCase()
  if (!query) {
    albumSearchResults.value = []
    return
  }
  albumSearchResults.value = allAlbums.value
    .filter(a => a.name.toLowerCase().includes(query))
    .slice(0, 5)
}

// 💡 앨범 선택 시 albumArtistName(displayArtist)도 함께 잡아옵니다!
const selectAlbum = (album) => {
  const updated = { 
    ...props.modelValue, 
    albumName: album.name, 
    albumId: album.id, 
    year: album.year || props.modelValue.year,
    albumArtistName: album.displayArtist || t('common.unknownArtist')
  }
  emit('update:modelValue', updated)
  albumSearchResults.value = []
  isAlbumFocused.value = false
}

const useTypedAlbumName = () => {
  const name = props.modelValue.albumName.trim()
  if (!name) return
  emit('update:modelValue', {
    ...props.modelValue,
    albumName: name,
    albumId: '',
  })
  albumSearchResults.value = []
  isAlbumFocused.value = false
}

const updateAlbumName = (value) => {
  emit('update:modelValue', {
    ...props.modelValue,
    albumName: value,
    albumId: '',
  })
  handleAlbumSearch()
}

const updateField = (field, value) => {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}

const showUseTypedAlbum = computed(() => {
  const q = props.modelValue.albumName.trim().toLowerCase()
  if (!q || !isAlbumFocused.value) return false
  return !allAlbums.value.some((a) => a.name.toLowerCase() === q)
})
</script>

<template>
  <div class="space-y-8 animate-in fade-in duration-500">
    
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="space-y-2">
        <Label class="text-[11px] font-black text-muted-foreground uppercase tracking-wider ml-1">{{ t('metadata.trackTitle') }}</Label>
        <Input 
          :model-value="modelValue.title" 
          @input="e => updateField('title', e.target.value)"
          class="text-lg font-bold h-12 border-2 focus-visible:ring-primary" 
        />
      </div>
      <div class="space-y-2">
        <Label class="text-[11px] font-black text-muted-foreground uppercase tracking-wider ml-1">{{ t('metadata.genre') }}</Label>
        <Input 
          :model-value="modelValue.genre" 
          @input="e => updateField('genre', e.target.value)"
          class="h-12 border-2"
        />
      </div>
    </div>

    <div class="pt-2">
      <div class="flex items-center gap-4 mb-6">
        <div class="h-[1px] flex-1 bg-border"></div>
        <span class="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{{ t('metadata.albumInfoSection') }}</span>
        <div class="h-[1px] flex-1 bg-border"></div>
      </div>

      <div class="flex flex-col md:flex-row gap-8 items-start">
        <div class="shrink-0 space-y-2">
          <Label class="text-[11px] font-black text-muted-foreground uppercase block text-center">{{ t('metadata.albumCoverLabel') }}</Label>
          <div 
            @click="$emit('request-tab-change', 'cover')" 
            class="w-40 h-40 bg-muted rounded-xl border-2 shadow-sm overflow-hidden relative group cursor-pointer ring-offset-background transition-all hover:ring-2 ring-primary ring-offset-2"
          >
            <img 
              v-if="modelValue.albumId || item.local.currentAlbumId"
              :src="auth.coverSrc('album', modelValue.albumId || item.local.currentAlbumId)"
              crossorigin="anonymous"
              class="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-110" 
            />
            
            <div class="absolute inset-0 bg-primary/60 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center text-white p-4 text-center">
              <ImageIcon class="w-6 h-6 mb-1" />
              <span class="text-[10px] font-black leading-tight">{{ t('metadata.changeInStudio') }}</span>
            </div>
          </div>
        </div>

        <div class="flex-1 w-full space-y-6">
          
          <div class="space-y-2 relative">
            <Label class="text-[11px] font-black text-muted-foreground uppercase">{{ t('external.albumName') }}</Label>
            <Input 
              :model-value="modelValue.albumName" 
              @input="e => updateAlbumName(e.target.value)"
              @focus="isAlbumFocused = true"
              @blur="handleAlbumBlur"
              class="bg-background font-bold h-11"
            />
            
            <div v-if="isAlbumFocused && (albumSearchResults.length > 0 || showUseTypedAlbum)" 
                 class="absolute top-full left-0 right-0 z-50 mt-1 bg-card border-2 shadow-2xl rounded-xl overflow-hidden">
              <button 
                v-for="album in albumSearchResults" :key="album.id"
                @click="selectAlbum(album)"
                class="w-full text-left px-4 py-3 hover:bg-muted flex items-center justify-between border-b last:border-none"
              >
                <div>
                  <p class="font-bold text-sm">{{ album.name }}</p>
                  <p class="text-[10px] text-muted-foreground">{{ album.displayArtist }}</p>
                </div>
                <div class="flex items-center gap-3">
                   <span class="text-[10px] font-bold text-muted-foreground">{{ album.year }}</span>
                   <Check class="w-4 h-4 text-primary" />
                </div>
              </button>
              <button
                v-if="showUseTypedAlbum"
                type="button"
                class="w-full text-left px-4 py-3 hover:bg-primary/10 text-primary font-bold text-sm border-t"
                @mousedown.prevent="useTypedAlbumName"
              >
                {{ t('metadata.useTypedAlbum', { name: modelValue.albumName.trim() }) }}
              </button>
            </div>
          </div>

          <div class="flex gap-4">
            <div class="space-y-2 flex-1">
              <Label class="text-[11px] font-black text-muted-foreground uppercase tracking-wider">{{ t('metadata.albumArtistAuto') }}</Label>
              <Input 
                :model-value="modelValue.albumArtistName" 
                readonly 
                disabled
                :placeholder="t('metadata.albumArtistPlaceholder')"
                class="bg-muted/30 font-bold text-muted-foreground h-11 border-dashed cursor-not-allowed"
              />
            </div>
            <div class="space-y-2 w-28 shrink-0">
              <Label class="text-[11px] font-black text-muted-foreground uppercase tracking-wider">{{ t('metadata.releaseYear') }}</Label>
              <Input 
                :model-value="modelValue.year" 
                @input="e => updateField('year', e.target.value)"
                type="number" 
                class="bg-background font-black text-center text-lg h-11"
              />
            </div>
          </div>
          
        </div>
      </div>
    </div>

    <div class="space-y-3 pt-2">
      <Label class="text-[11px] font-black text-muted-foreground uppercase ml-1">{{ t('metadata.tags') }}</Label>
      <TagsInput 
        :model-value="modelValue.tags" 
        @update:model-value="val => updateField('tags', val)"
        class="w-full bg-background rounded-xl border-2 p-2 min-h-[50px]"
      >
        <TagsInputItem v-for="tag in modelValue.tags" :key="tag" :value="tag" class="bg-primary text-primary-foreground">
          <TagsInputItemText class="text-xs font-bold" />
          <TagsInputItemDelete />
        </TagsInputItem>
        <TagsInputInput :placeholder="t('metadata.tagInput')" class="text-sm" />
      </TagsInput>
    </div>
  </div>
</template>