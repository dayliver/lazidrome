<script setup>
import { computed } from 'vue'
import { useVirtualList } from '@vueuse/core'
import { useGridColumns } from '@/composables/useGridColumns'

const props = defineProps({
  items: { type: Array, required: true },
  /** 한 행(그리드 줄)의 대략적인 높이(px) */
  rowHeight: { type: Number, default: 300 },
  /** 스크롤 영역 추가 클래스 */
  class: { type: String, default: '' },
})

const columns = useGridColumns()

const rows = computed(() => {
  const cols = Math.max(1, columns.value)
  const list = props.items || []
  const out = []
  for (let i = 0; i < list.length; i += cols) {
    out.push(list.slice(i, i + cols))
  }
  return out
})

const { list, containerProps, wrapperProps } = useVirtualList(rows, {
  itemHeight: props.rowHeight,
  overscan: 2,
})
</script>

<template>
  <div v-bind="containerProps" :class="['min-h-[50vh] max-h-[calc(100vh-12rem)] overflow-y-auto', props.class]">
    <div v-bind="wrapperProps">
      <div
        v-for="{ data: row, index } in list"
        :key="index"
        class="grid gap-4 md:gap-6 pb-4"
        :class="[
          columns === 2 ? 'grid-cols-2' : '',
          columns === 3 ? 'grid-cols-3' : '',
          columns === 4 ? 'grid-cols-4' : '',
          columns === 5 ? 'grid-cols-5' : '',
          columns === 6 ? 'grid-cols-6' : '',
        ]"
      >
        <template v-for="item in row" :key="item.id">
          <slot name="item" :item="item" />
        </template>
      </div>
    </div>
  </div>
</template>
