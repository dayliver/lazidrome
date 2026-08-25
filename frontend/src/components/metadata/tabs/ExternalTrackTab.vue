<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { 
  Globe, Database, ExternalLink, RefreshCw, 
  Search, Music, User, Image as ImageIcon, 
  CheckCircle2, Download, Zap
} from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useMetadataEditStore } from '@/stores/metadataEdit'
import { useExternalMetadataSearch } from '@/composables/useExternalMetadataSearch'
import { notify } from '@/lib/notify'
import { formatLocaleNumber } from '@/lib/localeFormat'

const props = defineProps({
  modelValue: { type: Object, required: true },
  item: { type: Object, required: true }
})
const emit = defineEmits(['update:modelValue'])

const metadataEdit = useMetadataEditStore()
const { searchMethod, fetchExternal, notifyMergeAll } = useExternalMetadataSearch()
const { t, locale } = useI18n()
const formatPlaycount = (n) => formatLocaleNumber(n, undefined, locale.value)

// 검색 모드 및 필드
const searchTitle = ref(props.modelValue.title || '')
const searchArtist = ref(props.modelValue.artists?.[0]?.name || '')
const searchMbid = ref(props.modelValue.mbid || '')

const handleFetch = () =>
  fetchExternal({
    textValid: () => {
      if (searchTitle.value && searchArtist.value) return true
      notify.warning(t('external.enterTrack'))
      return false
    },
    onText: () => metadataEdit.reFetchPreview(searchTitle.value, searchArtist.value),
    mbidValue: searchMbid.value,
    mbidMissingMessage: t('external.enterMbid'),
  })

// ============================================================================
// 💡 [핵심] 개별 데이터 적용 로직 (Smart Apply)
//
// ⚠️ props.modelValue는 부모가 리렌더될 때까지 갱신되지 않는다. 그래서 한 tick 안에서
//    emit을 연달아 호출하면 매번 같은 옛 객체를 spread 하게 되어 **마지막 emit만 살아남는다.**
//    각 patch*는 base 객체를 받아 새 객체를 돌려주는 순수 함수로 두고,
//    여러 필드를 적용할 때는 체이닝해서 emit을 딱 1회만 한다.
// ============================================================================

// 1. 곡 제목 적용
const patchTitle = (base) => {
  const extTitle = props.item.external?.title
  return extTitle ? { ...base, title: extTitle } : base
}

// 2. 아티스트 적용 (안전 병합: Safe Append)
const patchArtist = (base, { warnOnDuplicate = false } = {}) => {
  const extName = props.item.external?.artist
  if (!extName) return base

  const currentArtists = base.artists || []
  const isExisting = currentArtists.some(a => a.name.toLowerCase() === extName.toLowerCase())

  if (isExisting) {
    if (warnOnDuplicate) notify.warning(t('external.artistDuplicate'))
    return base
  }

  // 💉 핵심: 배열 맨 앞에 '임시 개체(id: null)'로 추가합니다.
  return { ...base, artists: [{ id: null, name: extName, role_mask: 1 }, ...currentArtists] }
}

// 3. 앨범 적용 (스마트 교체: Swap & Nullify ID)
const patchAlbum = (base) => {
  const extAlbum = props.item.external?.albumName
  if (!extAlbum) return base
  // 💉 핵심: 기존 ID를 날려서 백엔드가 이름으로 재검색/생성하게 유도
  return { ...base, albumName: extAlbum, albumId: null }
}

// 4. 커버 아트 적용
const patchCover = (base) => {
  const extImage = props.item.external?.imageUrl
  if (!extImage) return base
  return { ...base, newCoverUrl: extImage, newCoverFile: null } // 로컬 파일 우선순위 해제
}

const patchMbid = (base) => {
  const extMbid = props.item.external?.mbid
  return extMbid ? { ...base, mbid: extMbid } : base
}

const applyTitle = () => emit('update:modelValue', patchTitle(props.modelValue))
const applyArtist = () =>
  emit('update:modelValue', patchArtist(props.modelValue, { warnOnDuplicate: true }))
const applyAlbum = () => emit('update:modelValue', patchAlbum(props.modelValue))
const applyCover = () => emit('update:modelValue', patchCover(props.modelValue))

// 5. 전체 일괄 병합 (Merge All) — 체이닝 후 단일 emit
const applyAll = () => {
  const merged = patchMbid(patchCover(patchAlbum(patchArtist(patchTitle(props.modelValue)))))
  emit('update:modelValue', merged)
  notifyMergeAll()
}
</script>

<template>
  <div class="space-y-8 animate-in fade-in duration-500 pb-10">
    
    <div class="space-y-4 bg-muted/20 p-6 rounded-2xl border-2 border-dashed">
      <div class="flex items-center justify-between mb-2">
        <Label class="text-[11px] font-black text-muted-foreground uppercase tracking-widest">{{ t('external.trackLookup') }}</Label>
        <div class="flex bg-background border rounded-lg p-1">
          <button @click="searchMethod = 'text'" :class="['px-3 py-1 text-[10px] font-bold rounded-md transition-all', searchMethod === 'text' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted']">{{ t('external.searchByInfo') }}</button>
          <button @click="searchMethod = 'mbid'" :class="['px-3 py-1 text-[10px] font-bold rounded-md transition-all', searchMethod === 'mbid' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted']">{{ t('external.searchByMbid') }}</button>
        </div>
      </div>

      <div v-if="searchMethod === 'text'" class="grid grid-cols-2 gap-4">
        <div class="space-y-2">
          <Label class="text-[10px] font-bold ml-1 flex items-center gap-1"><Music class="w-3 h-3" /> {{ t('external.trackTitle') }}</Label>
          <Input v-model="searchTitle" :placeholder="t('external.trackTitle')" class="bg-background border-2 h-10" />
        </div>
        <div class="space-y-2">
          <Label class="text-[10px] font-bold ml-1 flex items-center gap-1"><User class="w-3 h-3" /> {{ t('external.artistName') }}</Label>
          <Input v-model="searchArtist" :placeholder="t('external.artistName')" class="bg-background border-2 h-10" />
        </div>
      </div>
      <div v-else class="space-y-2">
        <Label class="text-[10px] font-bold ml-1 flex items-center gap-1"><Database class="w-3 h-3" /> {{ t('external.musicbrainzId') }}</Label>
        <Input v-model="searchMbid" :placeholder="t('external.mbidRecording')" class="bg-background border-2 h-10 font-mono text-xs" />
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
                <p class="text-[10px] font-black text-muted-foreground uppercase">{{ t('external.foundTitle') }}</p>
              </div>
              <h3 class="font-black text-xl tracking-tight">{{ item.external.title || t('external.notAvailable') }}</h3>
            </div>
            <Button v-if="item.external.title" @click="applyTitle" variant="secondary" size="sm" class="h-7 text-[10px] font-bold">
              <Download class="w-3 h-3 mr-1" /> {{ t('external.applyTitle') }}
            </Button>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6 text-sm">
            
            <div class="flex items-center justify-between bg-muted/30 p-2 rounded-lg border">
              <div>
                <p class="text-[10px] font-black text-muted-foreground uppercase mb-0.5">{{ t('external.foundArtist') }}</p>
                <p class="font-bold text-primary">{{ item.external.artist || t('external.notAvailable') }}</p>
              </div>
              <Button v-if="item.external.artist" @click="applyArtist" variant="ghost" size="icon" class="h-8 w-8 hover:bg-primary/20 hover:text-primary" :title="t('external.applyArtist')">
                <Download class="w-4 h-4" />
              </Button>
            </div>
            
            <div class="flex items-center justify-between bg-muted/30 p-2 rounded-lg border">
              <div>
                <p class="text-[10px] font-black text-muted-foreground uppercase mb-0.5">{{ t('external.foundAlbum') }}</p>
                <p class="font-bold">{{ item.external.albumName || t('external.notAvailable') }}</p>
              </div>
              <Button v-if="item.external.albumName" @click="applyAlbum" variant="ghost" size="icon" class="h-8 w-8 hover:bg-primary/20 hover:text-primary" :title="t('external.applyAlbum')">
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