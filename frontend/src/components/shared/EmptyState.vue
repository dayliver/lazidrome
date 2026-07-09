<script setup>
const props = defineProps({
  /** Lucide 아이콘 컴포넌트 (선택) */
  icon: { type: [Object, Function], default: null },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  /** panel: 점선 테두리 패널 / plain: 배경 없는 중앙 정렬 */
  variant: { type: String, default: 'panel' },
})
</script>

<template>
  <div
    class="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground"
    :class="variant === 'panel' ? 'rounded-xl border border-dashed bg-muted/5' : ''"
  >
    <component :is="icon" v-if="icon" class="w-12 h-12 opacity-30" aria-hidden="true" />
    <p v-if="title" class="font-semibold text-foreground">{{ title }}</p>
    <p v-if="description" class="text-sm">{{ description }}</p>
    <slot />
  </div>
</template>
