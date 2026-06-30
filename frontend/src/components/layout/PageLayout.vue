<script setup>
defineOptions({ inheritAttrs: false })

defineProps({
  /** 섹션 간격: 6(기본) | 8 | 10 */
  spacing: {
    type: String,
    default: '6',
    validator: (v) => ['6', '8', '10'].includes(v),
  },
})
</script>

<template>
  <div
    v-bind="$attrs"
    class="w-full min-w-0"
    :class="{
      'space-y-6': spacing === '6',
      'space-y-8': spacing === '8',
      'space-y-10': spacing === '10',
    }"
  >
    <slot />
  </div>
</template>
