<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowUp, ArrowDown, RotateCcw } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import TrackListFilters from '@/components/shared/TrackListFilters.vue'
import { hasActiveTrackListFilters } from '@/lib/trackListQuery'

const props = defineProps({
  query: { type: Object, required: true },
  searchInput: { type: String, default: '' },
  total: { type: Number, default: 0 },
  shown: { type: Number, default: 0 },
  sortOptions: { type: Array, required: true },
  orderLockedHint: { type: String, default: '' },
})

const emit = defineEmits([
  'update:searchInput',
  'update:sort',
  'toggle-order',
  'toggle-starred',
  'set-min-rating',
  'reset-filters',
])

const { t } = useI18n()

const sortModel = computed({
  get: () => props.query.sort,
  set: (value) => emit('update:sort', value),
})

const showReset = computed(() => hasActiveTrackListFilters(props.query))
</script>

<template>
  <TrackListFilters
    :search-input="searchInput"
    :starred="Boolean(query.starred)"
    :min-rating="query.minRating"
    :total="total"
    :shown="shown"
    @update:search-input="emit('update:searchInput', $event)"
    @toggle-starred="emit('toggle-starred')"
    @set-min-rating="emit('set-min-rating', $event)"
  >
    <template #extra>
      <Select v-model="sortModel">
        <SelectTrigger
          class="w-[9.5rem] h-9 bg-background font-bold text-xs shadow-none"
          :title="orderLockedHint || undefined"
        >
          <SelectValue :placeholder="t('trackList.sort.label')" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="opt in sortOptions" :key="opt.value" :value="opt.value">
            {{ t(opt.labelKey) }}
          </SelectItem>
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        size="icon"
        class="shrink-0 h-9 w-9 bg-background shadow-none"
        :disabled="query.sort === 'manual'"
        :title="orderLockedHint || (query.order === 'asc' ? t('trackList.orderAsc') : t('trackList.orderDesc'))"
        :aria-label="query.order === 'asc' ? t('trackList.orderAsc') : t('trackList.orderDesc')"
        @click="emit('toggle-order')"
      >
        <ArrowUp v-if="query.order === 'asc'" class="w-4 h-4" />
        <ArrowDown v-else class="w-4 h-4" />
      </Button>

      <Button
        v-if="showReset"
        variant="ghost"
        size="icon"
        class="h-9 w-9 shrink-0 text-muted-foreground shadow-none"
        :title="t('trackList.resetFilters')"
        @click="emit('reset-filters')"
      >
        <RotateCcw class="w-4 h-4" />
      </Button>
    </template>
  </TrackListFilters>
</template>
