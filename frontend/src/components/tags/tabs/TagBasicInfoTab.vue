<script setup>
import { useI18n } from 'vue-i18n'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
const { t } = useI18n()

const props = defineProps({
  modelValue: { type: Object, required: true }
})

const emit = defineEmits(['update:modelValue'])

const updateField = (field, value) => {
  emit('update:modelValue', { ...props.modelValue, [field]: value })
}
</script>

<template>
  <div class="space-y-8 animate-in fade-in duration-500 max-w-2xl">
    <div class="space-y-2">
      <Label class="text-[11px] font-black text-muted-foreground uppercase tracking-wider ml-1">
        {{ t('tagEdit.name') }}
      </Label>
      <Input
        :model-value="modelValue.name"
        class="text-lg font-bold h-12 border-2 focus-visible:ring-primary"
        autocomplete="off"
        @input="(e) => updateField('name', e.target.value)"
      />
      <p class="text-xs text-muted-foreground leading-relaxed">
        {{ t('tagEdit.renameHint') }}
        <span class="font-bold text-foreground">/</span>,
        <span class="font-bold text-foreground">\</span>,
        <span class="font-bold text-foreground">..</span>
        {{ t('tagEdit.invalidCharsHint') }}
        {{ t('tagEdit.maxLengthHint') }}
      </p>
    </div>
  </div>
</template>
