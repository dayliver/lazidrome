<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Plus, X, Zap } from 'lucide-vue-next'
const { t } = useI18n()

const props = defineProps({
  modelValue: { type: Object, required: true },
  isEdit: Boolean
})
const emit = defineEmits(['update:modelValue'])

const updateField = (field, value) => {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}

const fieldOptions = computed(() => [
  { label: t('playlist.fieldStarred'), value: 'starred', type: 'boolean' },
  { label: t('playlist.fieldRating'), value: 'rating', type: 'number' },
  { label: t('playlist.fieldTags'), value: 'tags', type: 'string' },
  { label: t('playlist.fieldGenre'), value: 'genre', type: 'string' },
  { label: t('playlist.fieldPlayCount'), value: 'play_count', type: 'number' },
  { label: t('playlist.fieldYear'), value: 'year', type: 'number' }
])

const operators = computed(() => ({
  number: [
    { label: t('playlist.opGte'), value: '>=' }, { label: t('playlist.opLte'), value: '<=' },
    { label: t('playlist.opEq'), value: '=' }, { label: t('playlist.opNeq'), value: '!=' }
  ],
  string: [
    { label: t('playlist.opContains'), value: 'contains' },
    { label: t('playlist.opEq'), value: '=' }
  ]
}))

function updateConditionField(condition, field) {
  if (field === 'starred') {
    condition.operator = '='
    condition.value = '1'
  } else if (condition.field === 'starred') {
    condition.operator = '='
    condition.value = ''
  }
  condition.field = field
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
  <div class="space-y-5 sm:space-y-8 animate-in fade-in duration-500 h-full">
    
    <div class="space-y-3">
      <Label class="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">{{ t('playlist.labelType') }}</Label>
      <Tabs :model-value="modelValue.type" @update:model-value="val => updateField('type', val)" class="w-full">
        <TabsList class="grid w-full grid-cols-2 h-14 bg-muted/40 border p-1 rounded-xl">
          <TabsTrigger 
            value="list" 
            :disabled="isEdit" 
            class="h-full rounded-lg font-black text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all duration-300"
          >
            {{ t('playlist.typeManualList') }}
          </TabsTrigger>
          <TabsTrigger 
            value="mix" 
            :disabled="isEdit" 
            class="h-full rounded-lg font-black text-sm data-[state=active]:bg-smart data-[state=active]:text-white data-[state=active]:shadow-md transition-ui"
          >
            {{ t('playlist.typeSmartMixAuto') }}
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>

    <div class="flex gap-6">
      <div class="space-y-2 flex-1">
        <Label class="text-[11px] font-black text-muted-foreground uppercase tracking-wider ml-1">{{ t('playlist.labelTitle') }}</Label>
        <Input 
          :model-value="modelValue.name" @input="e => updateField('name', e.target.value)"
          :placeholder="t('playlist.namePlaceholder')" class="text-xl font-bold h-14 border-2 focus-visible:ring-primary" 
        />
      </div>
    </div>

    <div class="space-y-2">
      <Label class="text-[11px] font-black text-muted-foreground uppercase tracking-wider ml-1">{{ t('playlist.labelDescription') }}</Label>
      <Textarea 
        :model-value="modelValue.description" @input="e => updateField('description', e.target.value)"
        :placeholder="t('playlist.descriptionPlaceholder')" class="min-h-[120px] border-2 leading-relaxed resize-none"
      />
    </div>

    <div v-if="modelValue.type === 'mix'" class="pt-6 border-t-2 space-y-6 animate-in slide-in-from-top-4">
      <div class="flex flex-wrap items-center justify-between gap-2 px-1">
        <h3 class="text-lg font-black flex items-center gap-2"><Zap class="w-5 h-5 text-smart"/> {{ t('playlist.smartRules') }}</h3>
        <Button variant="outline" size="sm" @click="addCondition" class="font-bold border-2 hover:bg-smart/10 hover:text-smart"><Plus class="w-4 h-4 mr-1"/> {{ t('playlist.addCondition') }}</Button>
      </div>

      <div class="space-y-3">
        <div v-for="(cond, idx) in modelValue.rules.conditions" :key="idx" class="grid gap-2 lg:flex lg:items-center lg:gap-3 bg-muted/30 p-3 rounded-xl border-2 group transition-ui hover:border-smart/30">
          <Select :model-value="cond.field" @update:model-value="field => updateConditionField(cond, field)">
            <SelectTrigger :aria-label="t('playlist.ruleFieldLabel')" class="min-h-11 w-full lg:w-[160px] lg:min-h-0 bg-background font-bold border-none shadow-none"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="opt in fieldOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</SelectItem>
            </SelectContent>
          </Select>

          <Select v-if="cond.field === 'starred'" :model-value="String(cond.value)" @update:model-value="value => cond.value = value">
            <SelectTrigger :aria-label="t('playlist.ruleValueLabel')" class="min-h-11 w-full bg-background lg:min-h-0 lg:flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">{{ t('playlist.starredYes') }}</SelectItem>
              <SelectItem value="0">{{ t('playlist.starredNo') }}</SelectItem>
            </SelectContent>
          </Select>

          <Select v-else v-model="cond.operator">
            <SelectTrigger :aria-label="t('playlist.ruleOperatorLabel')" class="min-h-11 w-full lg:w-[160px] lg:min-h-0 bg-background border-none shadow-none"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="op in (fieldOptions.find(f => f.value === cond.field)?.type === 'number' ? operators.number : operators.string)" :key="op.value" :value="op.value">{{ op.label }}</SelectItem>
            </SelectContent>
          </Select>

          <Input v-if="cond.field !== 'starred'" v-model="cond.value" :aria-label="t('playlist.ruleValueLabel')" :type="fieldOptions.find(f => f.value === cond.field)?.type === 'number' ? 'number' : 'text'" class="min-h-11 lg:min-h-0 lg:flex-1 bg-background border-none shadow-none font-bold" />
          <Button variant="ghost" size="icon" :aria-label="t('common.remove')" @click="removeCondition(idx)" class="size-11 justify-self-end lg:size-9 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-ui"><X class="w-4 h-4"/></Button>
        </div>
        <div v-if="modelValue.rules.conditions.length === 0" class="text-center py-10 border-2 border-dashed rounded-xl text-muted-foreground text-sm font-medium bg-muted/5">
          {{ t('playlist.addConditionHint') }}
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 pt-2 lg:grid-cols-3 lg:gap-6">
        <div class="space-y-2">
          <Label class="text-[10px] font-black text-muted-foreground uppercase">{{ t('playlist.matchMode') }}</Label>
          <Select :model-value="modelValue.rules.match" @update:model-value="val => modelValue.rules.match = val">
            <SelectTrigger class="min-h-11 w-full bg-muted/50 border-2 font-bold lg:min-h-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{{ t('playlist.matchAll') }}</SelectItem>
              <SelectItem value="any">{{ t('playlist.matchAny') }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="space-y-2">
          <Label class="text-[10px] font-black text-muted-foreground uppercase">{{ t('playlist.sortBy') }}</Label>
          <Select :model-value="modelValue.rules.sortBy" @update:model-value="val => modelValue.rules.sortBy = val">
            <SelectTrigger class="min-h-11 w-full bg-muted/50 border-2 font-bold lg:min-h-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="random">{{ t('playlist.sortRandom') }}</SelectItem>
              <SelectItem value="newest">{{ t('playlist.sortNewest') }}</SelectItem>
              <SelectItem value="highest_rated">{{ t('playlist.sortRating') }}</SelectItem>
              <SelectItem value="most_played">{{ t('playlist.sortPlayed') }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="space-y-2">
          <Label class="text-[10px] font-black text-muted-foreground uppercase">{{ t('playlist.maxTracks') }}</Label>
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
          <p class="text-[10px] text-muted-foreground">{{ t('playlist.maxTracksHint') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>