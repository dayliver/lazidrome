<script setup>
defineOptions({ inheritAttrs: false })

defineProps({
  alt: { type: String, default: '' },
})
</script>

<template>
  <img
    src="/app-icon.svg"
    :alt="alt"
    class="shrink-0 object-contain"
    v-bind="$attrs"
  />
</template>
