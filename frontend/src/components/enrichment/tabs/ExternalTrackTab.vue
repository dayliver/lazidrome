<script setup>
import { ref } from 'vue'
import { 
  Globe, Database, ExternalLink, RefreshCw, 
  Search, Music, User, Image as ImageIcon, 
  CheckCircle2, Download, Zap
} from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useEnrichmentStore } from '@/stores/enrichment'

const props = defineProps({
  modelValue: { type: Object, required: true },
  item: { type: Object, required: true }
})
const emit = defineEmits(['update:modelValue'])

const enrichment = useEnrichmentStore()

// 검색 모드 및 필드
const searchMethod = ref('text')
const searchTitle = ref(props.modelValue.title || '')
const searchArtist = ref(props.modelValue.artists?.[0]?.name || '')
const searchMbid = ref(props.modelValue.mbid || '')

const handleFetch = async () => {
  if (searchMethod.value === 'text') {
    if (!searchTitle.value || !searchArtist.value) return alert('가수와 제목을 입력하세요.')
    await enrichment.reFetchPreview(searchTitle.value, searchArtist.value)
  } else {
    if (!searchMbid.value) return alert('MBID를 입력하세요.')
    await enrichment.reFetchPreview(null, null, searchMbid.value)
  }
}

const updateField = (field, value) => {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}

// ============================================================================
// 💡 [핵심] 개별 데이터 적용 로직 (Smart Apply)
// ============================================================================

// 1. 곡 제목 적용
const applyTitle = () => {
  if (props.item.external?.title) updateField('title', props.item.external.title)
}

// 2. 아티스트 적용 (안전 병합: Safe Append)
const applyArtist = () => {
  const extName = props.item.external?.artist
  if (!extName) return

  const currentArtists = props.modelValue.artists || []
  const isExisting = currentArtists.some(a => a.name.toLowerCase() === extName.toLowerCase())
  
  if (isExisting) {
    alert('이미 동일한 이름의 아티스트가 목록에 있습니다.')
    return
  }

  // 💉 핵심: 배열 맨 앞에 '임시 개체(id: null)'로 추가합니다.
  const updatedArtists = [{ id: null, name: extName, role_mask: 1 }, ...currentArtists]
  updateField('artists', updatedArtists)
}

// 3. 앨범 적용 (스마트 교체: Swap & Nullify ID)
const applyAlbum = () => {
  const extAlbum = props.item.external?.albumName
  if (!extAlbum) return

  emit('update:modelValue', {
    ...props.modelValue,
    albumName: extAlbum,
    albumId: null // 💉 핵심: 기존 ID를 날려서 백엔드가 이름으로 재검색/생성하게 유도
  })
}

// 4. 커버 아트 적용
const applyCover = () => {
  if (props.item.external?.imageUrl) {
    emit('update:modelValue', {
      ...props.modelValue,
      newCoverUrl: props.item.external.imageUrl,
      newCoverFile: null // 로컬 파일 우선순위 해제
    })
  }
}

// 5. 전체 일괄 병합 (Merge All)
const applyAll = () => {
  applyTitle()
  applyArtist()
  applyAlbum()
  applyCover()
  // MBID도 있으면 같이 덮어씌움
  if (props.item.external?.mbid) updateField('mbid', props.item.external.mbid)
  
  alert('모든 외부 데이터가 로컬 폼으로 병합되었습니다. "변경사항 저장"을 눌러 확정하세요.')
}
</script>

<template>
  <div class="space-y-8 animate-in fade-in duration-500 pb-10">
    
    <div class="space-y-4 bg-muted/20 p-6 rounded-2xl border-2 border-dashed">
      <div class="flex items-center justify-between mb-2">
        <Label class="text-[11px] font-black text-muted-foreground uppercase tracking-widest">Last.fm 데이터 조회</Label>
        <div class="flex bg-background border rounded-lg p-1">
          <button @click="searchMethod = 'text'" :class="['px-3 py-1 text-[10px] font-bold rounded-md transition-all', searchMethod === 'text' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted']">정보 검색</button>
          <button @click="searchMethod = 'mbid'" :class="['px-3 py-1 text-[10px] font-bold rounded-md transition-all', searchMethod === 'mbid' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted']">MBID 검색</button>
        </div>
      </div>

      <div v-if="searchMethod === 'text'" class="grid grid-cols-2 gap-4">
        <div class="space-y-2">
          <Label class="text-[10px] font-bold ml-1 flex items-center gap-1"><Music class="w-3 h-3" /> 곡 제목</Label>
          <Input v-model="searchTitle" placeholder="곡 제목" class="bg-background border-2 h-10" />
        </div>
        <div class="space-y-2">
          <Label class="text-[10px] font-bold ml-1 flex items-center gap-1"><User class="w-3 h-3" /> 아티스트</Label>
          <Input v-model="searchArtist" placeholder="아티스트 이름" class="bg-background border-2 h-10" />
        </div>
      </div>
      <div v-else class="space-y-2">
        <Label class="text-[10px] font-bold ml-1 flex items-center gap-1"><Database class="w-3 h-3" /> MusicBrainz ID</Label>
        <Input v-model="searchMbid" placeholder="Recording MBID 입력" class="bg-background border-2 h-10 font-mono text-xs" />
      </div>

      <div class="flex justify-end pt-2">
        <Button @click="handleFetch" :disabled="enrichment.isFetching" class="font-black px-8">
          <RefreshCw class="w-4 h-4 mr-2" :class="{ 'animate-spin': enrichment.isFetching }" />
          외부 데이터 불러오기
        </Button>
      </div>
    </div>

    <div class="pt-2">
      <div class="flex items-center gap-4 mb-6">
        <div class="h-[1px] flex-1 bg-border"></div>
        <span class="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] whitespace-nowrap">Last.fm Results & Apply</span>
        <div class="h-[1px] flex-1 bg-border"></div>
      </div>

      <div v-if="item.external" class="flex flex-col md:flex-row gap-6 bg-card border-2 border-primary/20 rounded-2xl p-6 relative overflow-hidden group shadow-md">
        <Globe class="absolute -right-4 -bottom-4 w-32 h-32 text-primary/5 group-hover:scale-110 transition-transform duration-700" />
        
        <div class="shrink-0 space-y-3">
          <div class="w-40 h-40 bg-muted rounded-xl border shadow-inner overflow-hidden relative">
            <img v-if="item.external.imageUrl" :src="item.external.imageUrl" class="w-full h-full object-cover" />
            <div v-else class="w-full h-full flex flex-col items-center justify-center text-muted-foreground/30">
              <ImageIcon class="w-10 h-10 mb-2" />
              <span class="text-[10px] font-bold uppercase">No Image</span>
            </div>
          </div>
          <Button v-if="item.external.imageUrl" @click="applyCover" variant="outline" class="w-full h-8 text-[11px] font-bold bg-background">
            <Download class="w-3 h-3 mr-1" /> 이 커버 적용
          </Button>
        </div>

        <div class="flex-1 space-y-5 relative z-10">
          
          <div class="flex items-start justify-between border-b border-primary/10 pb-4">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <CheckCircle2 class="w-4 h-4 text-green-500" />
                <p class="text-[10px] font-black text-muted-foreground uppercase">조회된 곡 제목</p>
              </div>
              <h3 class="font-black text-xl tracking-tight">{{ item.external.title || 'N/A' }}</h3>
            </div>
            <Button v-if="item.external.title" @click="applyTitle" variant="secondary" size="sm" class="h-7 text-[10px] font-bold">
              <Download class="w-3 h-3 mr-1" /> 제목 적용
            </Button>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6 text-sm">
            
            <div class="flex items-center justify-between bg-muted/30 p-2 rounded-lg border">
              <div>
                <p class="text-[10px] font-black text-muted-foreground uppercase mb-0.5">아티스트 (안전 추가)</p>
                <p class="font-bold text-primary">{{ item.external.artist || 'N/A' }}</p>
              </div>
              <Button v-if="item.external.artist" @click="applyArtist" variant="ghost" size="icon" class="h-8 w-8 hover:bg-primary/20 hover:text-primary" title="아티스트 목록에 추가">
                <Download class="w-4 h-4" />
              </Button>
            </div>
            
            <div class="flex items-center justify-between bg-muted/30 p-2 rounded-lg border">
              <div>
                <p class="text-[10px] font-black text-muted-foreground uppercase mb-0.5">소속 앨범 (스마트 교체)</p>
                <p class="font-bold">{{ item.external.albumName || 'N/A' }}</p>
              </div>
              <Button v-if="item.external.albumName" @click="applyAlbum" variant="ghost" size="icon" class="h-8 w-8 hover:bg-primary/20 hover:text-primary" title="이 앨범으로 교체">
                <Download class="w-4 h-4" />
              </Button>
            </div>

            <div>
              <p class="text-[10px] font-black text-muted-foreground uppercase mb-0.5">Playcount</p>
              <p class="font-mono font-bold">{{ Number(item.external.playcount || 0).toLocaleString() }}</p>
            </div>
            <div>
              <p class="text-[10px] font-black text-muted-foreground uppercase mb-0.5">MBID</p>
              <p class="font-mono text-[10px] truncate w-32" :title="item.external.mbid">{{ item.external.mbid || 'N/A' }}</p>
            </div>
          </div>

          <div class="pt-4 flex justify-end">
            <Button @click="applyAll" class="bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground font-black shadow-none border border-primary/20 transition-all">
              <Zap class="w-4 h-4 mr-2" /> 전체 자동 병합 (Merge All)
            </Button>
          </div>

        </div>
      </div>

      <div v-else class="p-16 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-muted-foreground/50">
        <Globe class="w-12 h-12 mb-4 opacity-20" />
        <p class="font-bold">외부 데이터 소스가 비어있습니다.</p>
        <p class="text-xs mt-1">위의 검색 설정을 확인한 후 데이터를 불러와주세요.</p>
      </div>
    </div>

  </div>
</template>