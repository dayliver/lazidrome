<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { 
  Globe, Database, RefreshCw, 
  Disc, User, Image as ImageIcon, 
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
const formatPlaycount = (n) => formatLocaleNumber(n, undefined, locale.value)

const props = defineProps({
  modelValue: { type: Object, required: true },
  item: { type: Object, required: true }
})
const emit = defineEmits(['update:modelValue'])

const metadataEdit = useMetadataEditStore()
const { searchMethod, fetchExternal, notifyMergeAll } = useExternalMetadataSearch()

// 💡 앨범 전용 검색 필드 초기화 (albumArtists 배열에서 첫 번째 이름을 가져옴)
const searchAlbum = ref(props.modelValue.title || '')
const searchArtist = ref(props.modelValue.albumArtists?.[0]?.name || '')
const searchMbid = ref(props.modelValue.mbid || '')

const handleFetch = () =>
  fetchExternal({
    textValid: () => {
      if (searchAlbum.value && searchArtist.value) return true
      notify.warning(t('external.enterAlbum'))
      return false
    },
    onText: () => metadataEdit.reFetchPreview(searchAlbum.value, searchArtist.value),
    mbidValue: searchMbid.value,
    mbidMissingMessage: t('external.enterMbid'),
  })

const updateField = (field, value) => {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}

// ============================================================================
// 💡 [앨범 전용] 데이터 병합 로직 (Smart Apply)
// ============================================================================

// 1. 앨범명 적용 (Last.fm은 name 또는 title로 반환할 수 있음)
const applyTitle = () => {
  const extTitle = props.item.external?.name || props.item.external?.title
  if (extTitle) updateField('title', extTitle)
}

// 2. 앨범 아티스트 적용 (role_mask 없이 순수하게 배열에 추가)
const applyArtist = () => {
  const extName = props.item.external?.artist
  if (!extName) return

  const currentArtists = props.modelValue.albumArtists || []
  const isExisting = currentArtists.some(a => a.name.toLowerCase() === extName.toLowerCase())
  
  if (isExisting) {
    notify.warning(t('external.albumArtistDuplicate'))
    return
  }

  // 앨범 소유주이므로 role_mask 불필요. ID는 null(신규)로 줍니다.
  const updatedArtists = [...currentArtists, { id: null, name: extName }]
  updateField('albumArtists', updatedArtists)
}

// 3. 커버 아트 적용
const applyCover = () => {
  if (props.item.external?.imageUrl) {
    emit('update:modelValue', {
      ...props.modelValue,
      newCoverUrl: props.item.external.imageUrl,
      newCoverFile: null
    })
  }
}

// 4. 전체 일괄 병합
const applyAll = () => {
  applyTitle()
  applyArtist()
  applyCover()
  if (props.item.external?.mbid) updateField('mbid', props.item.external.mbid)
  notifyMergeAll()
}
</script>

<template>
  <div class="space-y-8 animate-in fade-in duration-500 pb-10">
    
    <div class="space-y-4 bg-muted/20 p-6 rounded-2xl border-2 border-dashed">
      <div class="flex items-center justify-between mb-2">
        <Label class="text-[11px] font-black text-muted-foreground uppercase tracking-widest">{{ t('external.albumLookup') }}</Label>
        <div class="flex bg-background border rounded-lg p-1">
          <button @click="searchMethod = 'text'" :class="['px-3 py-1 text-[10px] font-bold rounded-md transition-all', searchMethod === 'text' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted']">{{ t('external.searchByInfo') }}</button>
          <button @click="searchMethod = 'mbid'" :class="['px-3 py-1 text-[10px] font-bold rounded-md transition-all', searchMethod === 'mbid' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted']">{{ t('external.searchByMbid') }}</button>
        </div>
      </div>

      <div v-if="searchMethod === 'text'" class="grid grid-cols-2 gap-4">
        <div class="space-y-2">
          <Label class="text-[10px] font-bold ml-1 flex items-center gap-1"><Disc class="w-3 h-3" /> {{ t('external.albumName') }}</Label>
          <Input v-model="searchAlbum" :placeholder="t('external.albumName')" class="bg-background border-2 h-10" />
        </div>
        <div class="space-y-2">
          <Label class="text-[10px] font-bold ml-1 flex items-center gap-1"><User class="w-3 h-3" /> {{ t('external.artistName') }}</Label>
          <Input v-model="searchArtist" :placeholder="t('external.artistName')" class="bg-background border-2 h-10" />
        </div>
      </div>
      <div v-else class="space-y-2">
        <Label class="text-[10px] font-bold ml-1 flex items-center gap-1"><Database class="w-3 h-3" /> {{ t('external.musicbrainzId') }}</Label>
        <Input v-model="searchMbid" :placeholder="t('external.mbidRelease')" class="bg-background border-2 h-10 font-mono text-xs" />
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
          <div class="w-40 h-40 bg-muted rounded-xl border shadow-inner overflow-hidden relative">
            <img v-if="item.external.imageUrl" :src="item.external.imageUrl" class="w-full h-full object-cover" />
            <div v-else class="w-full h-full flex flex-col items-center justify-center text-muted-foreground/30">
              <ImageIcon class="w-10 h-10 mb-2" />
              <span class="text-[10px] font-bold uppercase">{{ t('external.noImage') }}</span>
            </div>
          </div>
          <Button v-if="item.external.imageUrl" @click="applyCover" variant="outline" class="w-full h-8 text-[11px] font-bold bg-background">
            <Download class="w-3 h-3 mr-1" /> {{ t('external.applyCover') }}
          </Button>
        </div>

        <div class="flex-1 space-y-5 relative z-10">
          
          <div class="flex items-start justify-between border-b border-primary/10 pb-4">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <CheckCircle2 class="w-4 h-4 text-success" />
                <p class="text-[10px] font-black text-muted-foreground uppercase">{{ t('external.foundAlbumName') }}</p>
              </div>
              <h3 class="font-black text-xl tracking-tight">{{ item.external.name || item.external.title || t('external.notAvailable') }}</h3>
            </div>
            <Button v-if="item.external.name || item.external.title" @click="applyTitle" variant="secondary" size="sm" class="h-7 text-[10px] font-bold">
              <Download class="w-3 h-3 mr-1" /> {{ t('metadata.albumNameApply') }}
            </Button>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6 text-sm">
            
            <div class="flex items-center justify-between bg-muted/30 p-2 rounded-lg border">
              <div>
                <p class="text-[10px] font-black text-muted-foreground uppercase mb-0.5">{{ t('external.foundAlbumArtist') }}</p>
                <p class="font-bold text-primary">{{ item.external.artist || t('external.notAvailable') }}</p>
              </div>
              <Button v-if="item.external.artist" @click="applyArtist" variant="ghost" size="icon" class="h-8 w-8 hover:bg-primary/20 hover:text-primary" :title="t('external.applyArtist')">
                <Download class="w-4 h-4" />
              </Button>
            </div>

            <div>
              <p class="text-[10px] font-black text-muted-foreground uppercase mb-0.5">{{ t('external.playcount') }}</p>
              <p class="font-mono font-bold">{{ formatPlaycount(item.external.playcount || 0) }}</p>
            </div>
            <div>
              <p class="text-[10px] font-black text-muted-foreground uppercase mb-0.5">{{ t('external.mbidLabel') }}</p>
              <p class="font-mono text-[10px] truncate w-32" :title="item.external.mbid">{{ item.external.mbid || t('external.notAvailable') }}</p>
            </div>
          </div>

          <div class="pt-4 flex justify-end">
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