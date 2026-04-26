<script setup>
defineProps({
  title: {
    type: String,
    required: true
  }
})
</script>

<template>
  <div class="flex items-center gap-2 border-b pb-2">
    <slot name="icon" />
    <h2 class="text-2xl font-black tracking-tight">{{ title }}</h2>
    <div v-if="$slots.actions" class="ml-auto">
      <slot name="actions" />
    </div>
  </div>
</template>
