<script setup>
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Plus, X, Zap } from 'lucide-vue-next'

const props = defineProps({
  modelValue: { type: Object, required: true },
  isEdit: Boolean
})
const emit = defineEmits(['update:modelValue'])

const updateField = (field, value) => {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}

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
    { label: '일치 (=)', value: '=' }, { label: '불일치 (!=)', value: '!=' }
  ],
  string: [
    { label: '포함 (contains)', value: 'contains' },
    { label: '일치 (=)', value: '=' }
  ]
}

const addCondition = () => {
  const updated = { ...props.modelValue }
  updated.rules.conditions.push({ field: 'rating', operator: '>=', value: 4 })
  emit('update:modelValue', updated)
}

const removeCondition = (idx) => {
  const updated = { ...props.modelValue }
  updated.rules.conditions.splice(idx, 1)
  emit('update:modelValue', updated)
}
</script>

<template>
  <div class="space-y-8 animate-in fade-in duration-500 h-full">
    
    <div class="space-y-3">
      <Label class="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">Playlist Type</Label>
      <Tabs :model-value="modelValue.type" @update:model-value="val => updateField('type', val)" class="w-full">
        <TabsList class="grid w-full grid-cols-2 h-14 bg-muted/40 border p-1 rounded-xl">
          <TabsTrigger 
            value="list" 
            :disabled="isEdit" 
            class="h-full rounded-lg font-black text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-300"
          >
            일반 리스트 (수동)
          </TabsTrigger>
          <TabsTrigger 
            value="mix" 
            :disabled="isEdit" 
            class="h-full rounded-lg font-black text-sm data-[state=active]:bg-purple-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all duration-300"
          >
            스마트 믹스 (자동)
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>

    <div class="flex gap-6">
      <div class="space-y-2 flex-1">
        <Label class="text-[11px] font-black text-muted-foreground uppercase tracking-wider ml-1">Playlist Title</Label>
        <Input 
          :model-value="modelValue.name" @input="e => updateField('name', e.target.value)"
          placeholder="이름을 입력하세요" class="text-xl font-bold h-14 border-2 focus-visible:ring-primary" 
        />
      </div>
    </div>

    <div class="space-y-2">
      <Label class="text-[11px] font-black text-muted-foreground uppercase tracking-wider ml-1">Description</Label>
      <Textarea 
        :model-value="modelValue.description" @input="e => updateField('description', e.target.value)"
        placeholder="설명을 입력하세요 (선택 사항)" class="min-h-[120px] border-2 leading-relaxed resize-none"
      />
    </div>

    <div v-if="modelValue.type === 'mix'" class="pt-6 border-t-2 space-y-6 animate-in slide-in-from-top-4">
      <div class="flex items-center justify-between px-1">
        <h3 class="text-lg font-black flex items-center gap-2"><Zap class="w-5 h-5 text-purple-500"/> 자동 선곡 규칙</h3>
        <Button variant="outline" size="sm" @click="addCondition" class="font-bold border-2 hover:bg-purple-500/10 hover:text-purple-500"><Plus class="w-4 h-4 mr-1"/> 조건 추가</Button>
      </div>

      <div class="space-y-3">
        <div v-for="(cond, idx) in modelValue.rules.conditions" :key="idx" class="flex items-center gap-3 bg-muted/30 p-3 rounded-xl border-2 group transition-all hover:border-purple-500/30">
          <Select v-model="cond.field">
            <SelectTrigger class="w-[160px] bg-background font-bold border-none shadow-none"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="opt in fieldOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</SelectItem>
            </SelectContent>
          </Select>

          <Select v-model="cond.operator">
            <SelectTrigger class="w-[160px] bg-background border-none shadow-none"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="op in (fieldOptions.find(f => f.value === cond.field)?.type === 'number' ? operators.number : operators.string)" :key="op.value" :value="op.value">{{ op.label }}</SelectItem>
            </SelectContent>
          </Select>

          <Input v-model="cond.value" :type="fieldOptions.find(f => f.value === cond.field)?.type === 'number' ? 'number' : 'text'" class="flex-1 bg-background border-none shadow-none font-bold" />
          <Button variant="ghost" size="icon" @click="removeCondition(idx)" class="text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"><X class="w-4 h-4"/></Button>
        </div>
        <div v-if="modelValue.rules.conditions.length === 0" class="text-center py-10 border-2 border-dashed rounded-xl text-muted-foreground text-sm font-medium bg-muted/5">
          조건을 추가하면 자동으로 곡이 선별됩니다.
        </div>
      </div>

      <div class="grid grid-cols-3 gap-6 pt-2">
        <div class="space-y-2">
          <Label class="text-[10px] font-black text-muted-foreground uppercase">조건 일치 방식</Label>
          <Select :model-value="modelValue.rules.match" @update:model-value="val => modelValue.rules.match = val">
            <SelectTrigger class="bg-muted/50 border-2 font-bold"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">모두 만족 (AND)</SelectItem>
              <SelectItem value="any">하나라도 만족 (OR)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="space-y-2">
          <Label class="text-[10px] font-black text-muted-foreground uppercase">정렬 기준</Label>
          <Select :model-value="modelValue.rules.sortBy" @update:model-value="val => modelValue.rules.sortBy = val">
            <SelectTrigger class="bg-muted/50 border-2 font-bold"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="random">무작위 (Random)</SelectItem>
              <SelectItem value="newest">최신 추가순</SelectItem>
              <SelectItem value="highest_rated">별점 높은순</SelectItem>
              <SelectItem value="most_played">많이 들은순</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="space-y-2">
          <Label class="text-[10px] font-black text-muted-foreground uppercase">최대 곡 수</Label>
          <Input
            type="number"
            min="1"
            max="200"
            :model-value="modelValue.rules.limit"
            @input="e => {
              const n = parseInt(e.target.value, 10)
              modelValue.rules.limit = Number.isFinite(n) ? Math.min(200, Math.max(1, n)) : 50
            }"
            class="bg-muted/50 border-2 font-mono font-bold"
          />
          <p class="text-[10px] text-muted-foreground">최대 200곡까지 조회됩니다.</p>
        </div>
      </div>
    </div>
  </div>
</template>