<script setup>
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
        태그 이름
      </Label>
      <Input
        :model-value="modelValue.name"
        class="text-lg font-bold h-12 border-2 focus-visible:ring-primary"
        autocomplete="off"
        @input="(e) => updateField('name', e.target.value)"
      />
      <p class="text-xs text-muted-foreground leading-relaxed">
        아티스트·앨범·트랙·스마트 믹스 조건에 붙은 동일한 문자열이 모두 바뀝니다. 이름에는
        <span class="font-bold text-foreground">/</span>,
        <span class="font-bold text-foreground">\</span>,
        <span class="font-bold text-foreground">..</span>
        를 쓸 수 없고, 200자 이하여야 합니다.
      </p>
    </div>
  </div>
</template>
