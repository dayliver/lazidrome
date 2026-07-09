<script setup>
import { useI18n } from 'vue-i18n'
import { Heart } from 'lucide-vue-next'

const props = defineProps({
  starred: { type: Boolean, default: false },
  /** sm | md | lg */
  size: { type: String, default: 'md' },
  /** ghost | outline */
  variant: { type: String, default: 'ghost' },
})

const emit = defineEmits(['toggle'])
const { t } = useI18n()

const HEART_SIZES = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-7 h-7',
}

const BUTTON_SIZES = {
  sm: 'p-1',
  md: 'p-2',
  lg: 'h-12 w-12 flex items-center justify-center',
}
</script>

<template>
  <button
    type="button"
    class="rounded-full shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    :class="[
      BUTTON_SIZES[size] || BUTTON_SIZES.md,
      variant === 'outline'
        ? 'h-9 w-9 flex items-center justify-center border bg-background shadow-none hover:bg-muted/80'
        : 'hover:text-favorite hover:bg-favorite/10',
      starred ? 'text-favorite' : 'text-muted-foreground',
      variant === 'outline' && starred ? 'border-favorite/50' : '',
    ]"
    :aria-pressed="starred"
    :aria-label="starred ? t('player.favoriteRemove') : t('player.favoriteAdd')"
    @click="emit('toggle')"
  >
    <Heart
      :class="[
        HEART_SIZES[size] || HEART_SIZES.md,
        starred ? 'fill-favorite text-favorite' : '',
      ]"
    />
  </button>
</template>
