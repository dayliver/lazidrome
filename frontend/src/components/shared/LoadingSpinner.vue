<script setup>
const props = defineProps({
  /** sm | md | lg */
  size: { type: String, default: 'md' },
  label: { type: String, default: '' },
  /** true면 가로 배치 (목록 안 로딩 행), false면 세로 중앙 블록 */
  inline: { type: Boolean, default: false },
})

const RING_SIZES = {
  sm: 'h-5 w-5 border-2',
  md: 'h-8 w-8 border-4',
  lg: 'h-10 w-10 border-4',
}
</script>

<template>
  <div
    class="text-muted-foreground"
    :class="inline
      ? 'flex items-center gap-3 py-6 text-sm'
      : 'flex flex-col items-center justify-center gap-4 py-16 text-center'"
  >
    <span
      class="shrink-0 animate-spin rounded-full border-primary border-t-transparent"
      :class="RING_SIZES[size] || RING_SIZES.md"
      aria-hidden="true"
    />
    <p v-if="label" :class="inline ? '' : 'text-sm'">{{ label }}</p>
  </div>
</template>
