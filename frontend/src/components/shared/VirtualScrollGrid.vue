<script setup>
import { useGridColumns } from '@/composables/useGridColumns'

const props = defineProps({
  items: { type: Array, required: true },
  /** @deprecated — 페이지 스크롤 그리드로 전환, 무시됨 */
  rowHeight: { type: Number, default: 300 },
  class: { type: String, default: '' },
})

const columns = useGridColumns()
</script>

<template>
  <div
    :class="[
      'grid w-full min-w-0 gap-4 md:gap-6',
      props.class,
      columns === 2 ? 'grid-cols-2' : '',
      columns === 3 ? 'grid-cols-3' : '',
      columns === 4 ? 'grid-cols-4' : '',
      columns === 5 ? 'grid-cols-5' : '',
      columns === 6 ? 'grid-cols-6' : '',
    ]"
  >
    <template v-for="item in items" :key="item.id">
      <slot name="item" :item="item" />
    </template>
  </div>
</template>
