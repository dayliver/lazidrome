<script setup>
import DetailHeader from '@/components/shared/DetailHeader.vue'

defineProps({
  title: String,
  subtitle: String,
  imageUrl: String,
  stats: Array,
  isRoundImage: { type: Boolean, default: false },
  splitParentheticalTitle: { type: Boolean, default: false }
})
</script>

<template>
  <div class="relative w-full space-y-8 pb-12 pt-10">

    <DetailHeader
      :title="title"
      :subtitle="subtitle"
      :image-url="imageUrl"
      :stats="stats"
      :is-round-image="isRoundImage"
      :split-parenthetical-title="splitParentheticalTitle"
    >
      <template #actions>
        <slot name="actions" />
      </template>
    </DetailHeader>

    <div class="space-y-8 px-2 md:px-4 mt-6">
      <slot></slot>
    </div>
  </div>
</template>