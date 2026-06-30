<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search, Heart } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

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

      <Button
        type="button"
        variant="outline"
        size="icon"
        class="shrink-0 border-red-500/50 bg-background shadow-none"
        :aria-pressed="starred"
        @click="emit('toggle-starred')"
      >
        <Heart
          class="w-5 h-5"
          :class="starred ? 'text-red-500 fill-red-500' : 'text-red-500 fill-none'"
        />
      </Button>

      <div class="flex items-center gap-0.5">
        <button
          v-for="star in 5"
          :key="star"
          type="button"
          class="text-xl leading-none px-0.5 focus:outline-none transition-transform hover:scale-110"
          @click="emit('set-min-rating', star)"
        >
          <span :class="minRating != null && star <= minRating ? 'text-yellow-500' : 'text-muted-foreground/40'">
            {{ minRating != null && star <= minRating ? '★' : '☆' }}
          </span>
        </button>
      </div>

      <slot name="extra" />
    </div>

    <p class="text-xs font-bold text-muted-foreground uppercase tracking-widest shrink-0">
      {{ t('trackList.summary', { total, shown }) }}
    </p>
  </div>
</template>
