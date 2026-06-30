<script setup>
import { useI18n } from 'vue-i18n'
import { Image as ImageIcon } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuthStore } from '@/stores/auth'
import { getCoverUrl } from '@/lib/image'

// 💡 TagsInput UI 컴포넌트 임포트
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

const auth = useAuthStore()

// 일반 필드 업데이트 헬퍼
const updateField = (field, value) => {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}
</script>

<template>
  <div class="space-y-8 animate-in fade-in duration-500">
    
    <div class="flex gap-6">
      <div class="space-y-2 flex-1">
        <Label class="text-[11px] font-black text-muted-foreground uppercase tracking-wider ml-1">{{ t('metadata.albumTitle') }}</Label>
        <Input 
          :model-value="modelValue.title" 
          @input="e => updateField('title', e.target.value)"
          class="text-lg font-bold h-12 border-2 focus-visible:ring-primary" 
        />
      </div>
      <div class="space-y-2 w-32 shrink-0">
        <Label class="text-[11px] font-black text-muted-foreground uppercase tracking-wider ml-1">{{ t('metadata.releaseYear') }}</Label>
        <Input 
          :model-value="modelValue.year" 
          @input="e => updateField('year', e.target.value)"
          type="number" 
          class="bg-background font-black text-center text-lg h-12 border-2"
        />
      </div>
    </div>

    <div class="space-y-3 pt-2">
      <Label class="text-[11px] font-black text-muted-foreground uppercase tracking-wider ml-1">{{ t('metadata.albumTags') }}</Label>
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

    <div class="space-y-2">
      <Label class="text-[11px] font-black text-muted-foreground uppercase tracking-wider ml-1">{{ t('metadata.description') }}</Label>
      <Textarea
        :model-value="modelValue.description"
        :placeholder="t('metadata.descriptionPlaceholder')"
        class="min-h-[120px] border-2 leading-relaxed resize-y"
        @input="(e) => updateField('description', e.target.value)"
      />
    </div>

    <div class="pt-6">
      <div class="flex items-center gap-4 mb-8">
        <div class="h-[1px] flex-1 bg-border"></div>
        <span class="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{{ t('metadata.albumCoverLabel') }}</span>
        <div class="h-[1px] flex-1 bg-border"></div>
      </div>

      <div class="flex justify-center">
        <div 
          @click="$emit('request-tab-change', 'cover')" 
          class="w-56 h-56 bg-muted rounded-2xl border-2 shadow-sm overflow-hidden relative group cursor-pointer ring-offset-background transition-all hover:ring-4 ring-primary ring-offset-4"
        >
          <img 
            v-if="item.local.id && item.local.cover_type"
            :src="auth.coverSrc('album', item.local.id)"
            crossorigin="anonymous"
            class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
          />
          
          <div class="absolute inset-0 bg-primary/70 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center text-primary-foreground p-4 text-center backdrop-blur-sm">
            <ImageIcon class="w-10 h-10 mb-3 drop-shadow-md" />
            <span class="text-sm font-black leading-tight tracking-tight">{{ t('metadata.changeInStudio') }}</span>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
/* number 인풋 화살표 숨기기 */
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type="number"] {
  -moz-appearance: textfield;
}
</style>