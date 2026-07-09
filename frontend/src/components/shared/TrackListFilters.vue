<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import FavoriteButton from '@/components/shared/FavoriteButton.vue'
import StarRating from '@/components/shared/StarRating.vue'

const props = defineProps({
  searchInput: { type: String, default: '' },
  starred: { type: Boolean, default: false },
  minRating: { type: Number, default: null },
  total: { type: Number, default: 0 },
  shown: { type: Number, default: 0 },
})

const emit = defineEmits(['update:searchInput', 'toggle-starred', 'set-min-rating'])

const { t } = useI18n()

const searchModel = computed({
  get: () => props.searchInput,
  set: (value) => emit('update:searchInput', value),
})
</script>

<template>
  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border bg-muted/20 p-4">
    <div class="flex flex-wrap items-center gap-3 min-w-0 flex-1">
      <div class="relative w-full sm:max-w-sm sm:flex-1">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          v-model="searchModel"
          :placeholder="t('trackList.searchPlaceholder')"
          class="pl-9 bg-background font-bold"
        />
      </div>

      <FavoriteButton
        :starred="starred"
        variant="outline"
        size="md"
        @toggle="emit('toggle-starred')"
      />

      <StarRating
        :rating="minRating || 0"
        interactive
        size="sm"
        @change="emit('set-min-rating', $event === 0 ? null : $event)"
      />

      <slot name="extra" />
    </div>

    <p class="text-xs font-bold text-muted-foreground uppercase tracking-widest shrink-0">
      {{ t('trackList.summary', { total, shown }) }}
    </p>
  </div>
</template>
