<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Input } from '@/components/ui/input'

const props = defineProps({
  modelValue: { type: String, default: '' },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: '' },
  inputClass: { type: String, default: 'h-8 text-xs' },
})

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()
const focused = ref(false)

const filtered = computed(() => {
  const q = String(props.modelValue ?? '').trim().toLowerCase()
  const list = props.options || []
  if (!q) return list.slice(0, 8)
  return list.filter((opt) => String(opt.name ?? '').toLowerCase().includes(q)).slice(0, 8)
})

const showUseTyped = computed(() => {
  const q = String(props.modelValue ?? '').trim()
  if (!q || !focused.value) return false
  return !(props.options || []).some((opt) => String(opt.name ?? '').toLowerCase() === q.toLowerCase())
})

function onBlur() {
  window.setTimeout(() => {
    focused.value = false
  }, 200)
}
</script>

<template>
  <div class="relative min-w-0">
    <Input
      :model-value="modelValue"
      class="w-full"
      :class="inputClass"
      :placeholder="placeholder"
      @update:model-value="emit('update:modelValue', String($event ?? ''))"
      @focus="focused = true"
      @blur="onBlur"
    />
    <div
      v-if="focused && (filtered.length || showUseTyped)"
      class="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto bg-card border shadow-lg rounded-lg"
    >
      <button
        v-for="opt in filtered"
        :key="opt.id ?? opt.name"
        type="button"
        class="w-full text-left px-3 py-2 hover:bg-muted border-b last:border-b-0"
        @mousedown.prevent="emit('update:modelValue', opt.name); focused = false"
      >
        <p class="text-xs font-semibold truncate">{{ opt.name }}</p>
        <p v-if="opt.subtitle" class="text-[10px] text-muted-foreground truncate">{{ opt.subtitle }}</p>
      </button>
      <button
        v-if="showUseTyped"
        type="button"
        class="w-full text-left px-3 py-2 hover:bg-primary/10 text-primary text-xs font-semibold border-t"
        @mousedown.prevent="emit('update:modelValue', modelValue.trim()); focused = false"
      >
        {{ t('import.files.useTypedValue', { value: modelValue.trim() }) }}
      </button>
    </div>
  </div>
</template>
