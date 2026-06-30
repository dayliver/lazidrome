<script setup>
import TrackListFilters from '@/components/shared/TrackListFilters.vue'

defineProps({
  searchInput: { type: String, default: '' },
  starred: { type: Boolean, default: false },
  minRating: { type: Number, default: null },
  total: { type: Number, default: 0 },
  shown: { type: Number, default: 0 },
})

defineEmits(['update:searchInput', 'toggle-starred', 'set-min-rating'])
</script>

<template>
  <TrackListFilters
    :search-input="searchInput"
    :starred="starred"
    :min-rating="minRating"
    :total="total"
    :shown="shown"
    @update:search-input="$emit('update:searchInput', $event)"
    @toggle-starred="$emit('toggle-starred')"
    @set-min-rating="$emit('set-min-rating', $event)"
  />
</template>
