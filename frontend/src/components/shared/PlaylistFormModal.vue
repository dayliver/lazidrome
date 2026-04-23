<script setup>
import { ref, watch, computed } from 'vue'
import { usePlaylistStore } from '@/stores/playlist'
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from '@/components/ui/dialog'
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2, Zap, ListMusic, Save, X } from 'lucide-vue-next'

const props = defineProps({
  isOpen: Boolean,
  editTarget: { type: Object, default: null }
})

const emit = defineEmits(['update:isOpen', 'success'])

const playlistStore = usePlaylistStore()
const isSubmitting = ref(false)

const form = ref({
  name: '', description: '', type: 'list',
  rules: { match: 'all', conditions: [], sortBy: 'random', limit: 50 }
})

const fieldOptions = [
  { label: '별점', value: 'rating', type: 'number' },
  { label: '태그', value: 'tags', type: 'string' },
  { label: '장르', value: 'genre', type: 'string' },
  { label: '재생 횟수', value: 'play_count', type: 'number' },
  { label: '발매 연도', value: 'year', type: 'number' }
]

const operators = {
  number: [
    { label: '이상 (>=)', value: '>=' }, { label: '이하 (<=)', value: '<=' },
    { label: '초과 (>)', value: '>' }, { label: '미만 (<)', value: '<' },
    { label: '일치 (=)', value: '=' }, { label: '불일치 (!=)', value: '!=' }
  ],
  string: [
    { label: '포함 (contains)', value: 'contains' },
    { label: '제외 (not contains)', value: 'not_contains' },
    { label: '일치 (=)', value: '=' }
  ]
}

watch(() => props.isOpen, (open) => {
  if (open) {
    if (props.editTarget) {
      form.value = {
        ...props.editTarget,
        rules: props.editTarget.rules || { match: 'all', conditions: [], sortBy: 'random', limit: 50 }
      }
    } else {
      form.value = {
        name: '', description: '', type: 'list',
        rules: { match: 'all', conditions: [], sortBy: 'random', limit: 50 }
      }
    }
  }
})

const addCondition = () => form.value.rules.conditions.push({ field: 'rating', operator: '>=', value: 4 })
const removeCondition = (index) => form.value.rules.conditions.splice(index, 1)

const handleSave = async () => {
  if (!form.value.name.trim()) return alert('제목을 입력해주세요.')
  isSubmitting.value = true
  try {
    let result;
    if (props.editTarget) result = await playlistStore.updatePlaylist(props.editTarget.id, form.value)
    else result = await playlistStore.createPlaylist(form.value)

    if (result || props.editTarget) {
      emit('success')
      emit('update:isOpen', false)
    }
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <Dialog :open="isOpen" @update:open="emit('update:isOpen', $event)">
    <DialogContent class="max-w-2xl h-[650px] flex flex-col p-6 font-sans overflow-hidden">
      
      <DialogHeader class="shrink-0 mb-2">
        <DialogTitle class="text-2xl font-black flex items-center gap-2">
          <component :is="form.type === 'mix' ? Zap : ListMusic" class="w-6 h-6 text-primary" />
          {{ editTarget ? '플레이리스트 정보 수정' : '새 플레이리스트 만들기' }}
        </DialogTitle>
      </DialogHeader>

      <div class="flex-1 overflow-y-auto pr-2 space-y-6 custom-scrollbar">
        <div class="space-y-3">
          <Label class="text-xs font-black uppercase text-muted-foreground tracking-widest">플레이리스트 유형</Label>
          <Tabs v-model="form.type" class="w-full">
            <TabsList class="grid w-full grid-cols-2 h-12">
              <TabsTrigger value="list" :disabled="!!editTarget" class="font-bold">일반 리스트 (수동)</TabsTrigger>
              <TabsTrigger value="mix" :disabled="!!editTarget" class="font-bold">스마트 믹스 (자동)</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div class="grid gap-4">
          <div class="space-y-2">
            <Label for="name" class="font-bold text-sm">제목</Label>
            <Input id="name" v-model="form.name" placeholder="제목을 입력하세요" class="h-11 font-medium" />
          </div>
          <div class="space-y-2">
            <Label for="desc" class="font-bold text-sm">설명</Label>
            <Textarea id="desc" v-model="form.description" placeholder="이 플레이리스트에 대한 설명..." class="resize-none" />
          </div>
        </div>

        <div v-if="form.type === 'mix'" class="space-y-4 pt-4 border-t">
          <div class="flex items-center justify-between">
            <Label class="text-base font-black flex items-center gap-2">
              <Zap class="w-4 h-4 text-purple-500" /> 자동 선곡 규칙
            </Label>
            <Button variant="outline" size="sm" @click="addCondition" class="font-bold">
              <Plus class="w-4 h-4 mr-1" /> 조건 추가
            </Button>
          </div>

          <div class="space-y-3">
            <div v-for="(cond, idx) in form.rules.conditions" :key="idx" class="flex items-center gap-2 bg-muted/30 p-2 rounded-lg group animate-in slide-in-from-left-2">
              <Select v-model="cond.field">
                <SelectTrigger class="w-[130px] bg-background font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="opt in fieldOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</SelectItem>
                </SelectContent>
              </Select>

              <Select v-model="cond.operator">
                <SelectTrigger class="w-[140px] bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="op in (fieldOptions.find(f => f.value === cond.field)?.type === 'number' ? operators.number : operators.string)" :key="op.value" :value="op.value">
                    {{ op.label }}
                  </SelectItem>
                </SelectContent>
              </Select>

              <Input v-model="cond.value" :type="fieldOptions.find(f => f.value === cond.field)?.type === 'number' ? 'number' : 'text'" class="flex-1 bg-background font-bold" />
              <Button variant="ghost" size="icon" @click="removeCondition(idx)" class="text-muted-foreground hover:text-red-500"><X class="w-4 h-4" /></Button>
            </div>
            <div v-if="form.rules.conditions.length === 0" class="text-center py-8 border-2 border-dashed rounded-xl text-muted-foreground text-sm">
              조건을 추가하면 자동으로 곡이 선별됩니다.
            </div>
          </div>

          <div class="grid grid-cols-3 gap-4 pt-2">
            <div class="space-y-2">
              <Label class="text-xs font-bold text-muted-foreground">조건 일치 방식</Label>
              <Select v-model="form.rules.match">
                <SelectTrigger class="bg-muted/50 font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">모두 만족 (AND)</SelectItem>
                  <SelectItem value="any">하나라도 만족 (OR)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="space-y-2">
              <Label class="text-xs font-bold text-muted-foreground">정렬 기준</Label>
              <Select v-model="form.rules.sortBy">
                <SelectTrigger class="bg-muted/50 font-bold"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="random">무작위 (Random)</SelectItem>
                  <SelectItem value="newest">최신 추가순</SelectItem>
                  <SelectItem value="highest_rated">별점 높은순</SelectItem>
                  <SelectItem value="most_played">많이 들은순</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="space-y-2">
              <Label class="text-xs font-bold text-muted-foreground">최대 곡 수</Label>
              <Input type="number" v-model="form.rules.limit" class="bg-muted/50 font-mono font-bold" />
            </div>
          </div>
        </div>
      </div>

      <DialogFooter class="shrink-0 border-t pt-4 mt-2">
        <Button variant="ghost" @click="emit('update:isOpen', false)" class="font-bold">취소</Button>
        <Button @click="handleSave" :disabled="isSubmitting" class="font-black px-10">
          <Save class="w-4 h-4 mr-2" /> {{ editTarget ? '저장하기' : '생성하기' }}
        </Button>
      </DialogFooter>
      
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: hsl(var(--muted)); border-radius: 10px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: hsl(var(--muted-foreground) / 0.4); }
</style>