<script setup>
import { useI18n } from 'vue-i18n'
import { Image as ImageIcon } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuthStore } from '@/stores/auth'
import { getCoverUrl } from '@/lib/image'

// 💡 누락되었던 Tags 임포트 복구!
import { 
  TagsInput, TagsInputInput, TagsInputItem, 
  TagsInputItemDelete, TagsInputItemText 
} from '@/components/ui/tags-input'
const { t } = useI18n()

const props = defineProps({
  modelValue: { type: Object, required: true },
  item: { type: Object, required: true }
})
const emit = defineEmits(['update:modelValue', 'request-tab-change'])

const auth = useAuthStore()

const updateField = (field, value) => {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}
</script>

<template>
  <div class="space-y-8 animate-in fade-in duration-500">
    <div class="space-y-2">
      <Label class="text-[11px] font-black text-muted-foreground uppercase tracking-wider ml-1">{{ t('metadata.artistName') }}</Label>
      <Input 
        :model-value="modelValue.title" 
        @input="e => updateField('title', e.target.value)"
        class="text-lg font-bold h-12 border-2 focus-visible:ring-primary" 
      />
    </div>

    <div class="space-y-2">
      <Label class="text-[11px] font-black text-muted-foreground uppercase tracking-wider ml-1">{{ t('metadata.biography') }}</Label>
      <Textarea 
        :model-value="modelValue.biography" 
        @input="e => updateField('biography', e.target.value)"
        :placeholder="t('metadata.biographyPlaceholder')" 
        class="min-h-[160px] border-2 leading-relaxed resize-none"
      />
    </div>

    <div class="space-y-3 pt-2">
      <Label class="text-[11px] font-black text-muted-foreground uppercase tracking-wider ml-1">{{ t('metadata.tags') }}</Label>
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

    <div class="pt-6">
      <div class="flex items-center gap-4 mb-8">
        <div class="h-[1px] flex-1 bg-border"></div>
        <span class="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{{ t('metadata.profileImageLabel') }}</span>
        <div class="h-[1px] flex-1 bg-border"></div>
      </div>

      <div class="flex justify-center">
        <div 
          @click="$emit('request-tab-change', 'cover')" 
          class="w-56 h-56 bg-muted rounded-full border-4 border-background shadow-lg overflow-hidden relative group cursor-pointer"
        >
          <img 
            v-if="item?.local?.id"
            :src="auth.coverSrc('artist', item.local.id)"
            crossorigin="anonymous"
            class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
          />
          <div class="absolute inset-0 bg-primary/70 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center text-primary-foreground">
             <ImageIcon class="w-8 h-8 mb-2" />
             <span class="text-xs font-bold">{{ t('metadata.changePhoto') }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: hsl(var(--muted)); border-radius: 10px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: hsl(var(--muted-foreground) / 0.4); }
</style>