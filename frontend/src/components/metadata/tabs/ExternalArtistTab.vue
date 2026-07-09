<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { 
  Globe, Database, RefreshCw, 
  User, Image as ImageIcon, FileText, Tags,
  CheckCircle2, Download, Zap
} from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useMetadataEditStore } from '@/stores/metadataEdit'
import { useExternalMetadataSearch } from '@/composables/useExternalMetadataSearch'
import { notify } from '@/lib/notify'
import { formatLocaleNumber } from '@/lib/localeFormat'
const { t, locale } = useI18n()
const formatListeners = (n) => formatLocaleNumber(n, undefined, locale.value)

const props = defineProps({
  modelValue: { type: Object, required: true },
  item: { type: Object, required: true }
})
const emit = defineEmits(['update:modelValue'])

const metadataEdit = useMetadataEditStore()
const { searchMethod, fetchExternal, notifyMergeAll } = useExternalMetadataSearch()

// 💡 아티스트 전용 검색 필드
const searchArtist = ref(props.modelValue.title || '')
const searchMbid = ref(props.modelValue.mbid || '')

const handleFetch = () =>
  fetchExternal({
    textValid: () => {
      if (searchArtist.value) return true
      notify.warning(t('external.enterArtist'))
      return false
    },
    onText: () => metadataEdit.reFetchPreview(searchArtist.value, ''),
    mbidValue: searchMbid.value,
    mbidMissingMessage: t('external.enterMbid'),
  })

const updateField = (field, value) => {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}

// ============================================================================
// 💡 [아티스트 전용] 데이터 병합 로직 (Smart Apply)
// ============================================================================

const applyTitle = () => {
  if (props.item.external?.name) updateField('title', props.item.external.name)
}

const applyBio = () => {
  if (props.item.external?.bio) updateField('biography', props.item.external.bio)
}

const applyTags = () => {
  const extTags = props.item.external?.tags
  if (!extTags || extTags.length === 0) return

  const currentTags = props.modelValue.tags || []
  // 중복 태그 방지 필터링
  const newTags = extTags.filter(t => !currentTags.includes(t))
  
  if (newTags.length === 0) {
    notify.warning(t('external.tagsNoneNew'))
    return
  }
  updateField('tags', [...currentTags, ...newTags])
}

const applyCover = () => {
  if (props.item.external?.imageUrl) {
    emit('update:modelValue', {
      ...props.modelValue,
      newCoverUrl: props.item.external.imageUrl,
      newCoverFile: null
    })
  }
}

const applyAll = () => {
  applyTitle()
  applyBio()
  applyTags()
  applyCover()
  if (props.item.external?.mbid) updateField('mbid', props.item.external.mbid)
  notifyMergeAll()
}
</script>

<template>
  <div class="space-y-8 animate-in fade-in duration-500 pb-10">
    
    <div class="space-y-4 bg-muted/20 p-6 rounded-2xl border-2 border-dashed">
      <div class="flex items-center justify-between mb-2">
        <Label class="text-[11px] font-black text-muted-foreground uppercase tracking-widest">{{ t('external.artistLookup') }}</Label>
        <div class="flex bg-background border rounded-lg p-1">
          <button @click="searchMethod = 'text'" :class="['px-3 py-1 text-[10px] font-bold rounded-md transition-all', searchMethod === 'text' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted']">{{ t('external.searchByInfo') }}</button>
          <button @click="searchMethod = 'mbid'" :class="['px-3 py-1 text-[10px] font-bold rounded-md transition-all', searchMethod === 'mbid' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted']">{{ t('external.searchByMbid') }}</button>
        </div>
      </div>

      <div v-if="searchMethod === 'text'" class="space-y-2">
        <Label class="text-[10px] font-bold ml-1 flex items-center gap-1"><User class="w-3 h-3" /> {{ t('metadata.artistName') }}</Label>
        <Input v-model="searchArtist" :placeholder="t('metadata.searchArtistPlaceholder')" class="bg-background border-2 h-10 max-w-md" @keyup.enter="handleFetch" />
      </div>
      <div v-else class="space-y-2">
        <Label class="text-[10px] font-bold ml-1 flex items-center gap-1"><Database class="w-3 h-3" /> {{ t('external.musicbrainzId') }}</Label>
        <Input v-model="searchMbid" :placeholder="t('external.mbidArtist')" class="bg-background border-2 h-10 font-mono text-xs max-w-md" @keyup.enter="handleFetch" />
      </div>

      <div class="flex justify-end pt-2">
        <Button @click="handleFetch" :disabled="metadataEdit.isFetching" class="font-black px-8">
          <RefreshCw class="w-4 h-4 mr-2" :class="{ 'animate-spin': metadataEdit.isFetching }" />
          {{ t('external.fetch') }}
        </Button>
      </div>
    </div>

    <div class="pt-2">
      <div class="flex items-center gap-4 mb-6">
        <div class="h-[1px] flex-1 bg-border"></div>
        <span class="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] whitespace-nowrap">{{ t('external.resultsDivider') }}</span>
        <div class="h-[1px] flex-1 bg-border"></div>
      </div>

      <div v-if="item.external" class="flex flex-col md:flex-row gap-6 bg-card border-2 border-primary/20 rounded-2xl p-6 relative overflow-hidden group shadow-md">
        <Globe class="absolute -right-4 -bottom-4 w-32 h-32 text-primary/5 group-hover:scale-110 transition-transform duration-700" />
        
        <div class="shrink-0 space-y-3">
          <div class="w-40 h-40 bg-muted rounded-full border-4 border-background shadow-lg overflow-hidden relative">
            <img v-if="item.external.imageUrl" :src="item.external.imageUrl" class="w-full h-full object-cover" />
            <div v-else class="w-full h-full flex flex-col items-center justify-center text-muted-foreground/30">
              <ImageIcon class="w-10 h-10 mb-2" />
            </div>
          </div>
          <Button v-if="item.external.imageUrl" @click="applyCover" variant="outline" class="w-full h-8 text-[11px] font-bold bg-background">
            <Download class="w-3 h-3 mr-1" /> {{ t('external.applyPhoto') }}
          </Button>
        </div>

        <div class="flex-1 space-y-5 relative z-10">
          
          <div class="flex items-start justify-between border-b border-primary/10 pb-3">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <CheckCircle2 class="w-4 h-4 text-success" />
                <p class="text-[10px] font-black text-muted-foreground uppercase">{{ t('external.foundArtistName') }}</p>
              </div>
              <h3 class="font-black text-2xl tracking-tight">{{ item.external.name || t('external.notAvailable') }}</h3>
            </div>
            <Button v-if="item.external.name" @click="applyTitle" variant="secondary" size="sm" class="h-7 text-[10px] font-bold">
              <Download class="w-3 h-3 mr-1" /> {{ t('external.applyName') }}
            </Button>
          </div>
          
          <div class="space-y-4 text-sm">
            
            <div class="bg-muted/30 p-3 rounded-lg border">
              <div class="flex items-center justify-between mb-2">
                <p class="text-[10px] font-black text-muted-foreground uppercase flex items-center gap-1"><FileText class="w-3 h-3"/> {{ t('external.bio') }}</p>
                <Button v-if="item.external.bio" @click="applyBio" variant="ghost" size="icon" class="h-6 w-6 hover:bg-primary/20 hover:text-primary">
                  <Download class="w-3 h-3" />
                </Button>
              </div>
              <p class="text-xs text-muted-foreground line-clamp-3 leading-relaxed">{{ item.external.bio || t('external.noBio') }}</p>
            </div>

            <div class="flex items-center justify-between bg-muted/30 p-3 rounded-lg border">
              <div>
                <p class="text-[10px] font-black text-muted-foreground uppercase flex items-center gap-1 mb-1"><Tags class="w-3 h-3"/> {{ t('external.genreTags') }}</p>
                <div class="flex flex-wrap gap-1">
                  <span v-for="tag in (item.external.tags || []).slice(0, 5)" :key="tag" class="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-bold">
                    {{ tag }}
                  </span>
                  <span v-if="!item.external.tags?.length" class="text-xs text-muted-foreground">{{ t('external.noTags') }}</span>
                </div>
              </div>
              <Button v-if="item.external.tags?.length" @click="applyTags" variant="ghost" size="icon" class="h-8 w-8 hover:bg-primary/20 hover:text-primary">
                <Download class="w-4 h-4" />
              </Button>
            </div>

            <div class="flex gap-6 pt-2">
              <div>
                <p class="text-[10px] font-black text-muted-foreground uppercase mb-0.5">{{ t('external.listeners') }}</p>
                <p class="font-mono font-bold text-xs">{{ formatListeners(item.external.playcount || 0) }}</p>
              </div>
              <div>
                <p class="text-[10px] font-black text-muted-foreground uppercase mb-0.5">{{ t('external.mbidLabel') }}</p>
                <p class="font-mono text-[10px] truncate w-32" :title="item.external.mbid">{{ item.external.mbid || t('external.notAvailable') }}</p>
              </div>
            </div>

          </div>

          <div class="pt-2 flex justify-end">
            <Button @click="applyAll" class="bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground font-black shadow-none border border-primary/20 transition-all">
              <Zap class="w-4 h-4 mr-2" /> {{ t('external.mergeAll') }}
            </Button>
          </div>

        </div>
      </div>

      <div v-else class="p-16 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-muted-foreground/50">
        <Globe class="w-12 h-12 mb-4 opacity-20" />
        <p class="font-bold">{{ t('external.emptySource') }}</p>
        <p class="text-xs mt-1">{{ t('external.emptySourceHint') }}</p>
      </div>
    </div>

  </div>
</template>