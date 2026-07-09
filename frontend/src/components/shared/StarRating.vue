<script setup>
import { useI18n } from 'vue-i18n'
import { Star } from 'lucide-vue-next'

const props = defineProps({
  rating: { type: Number, default: 0 },
  /** false면 표시 전용 */
  interactive: { type: Boolean, default: false },
  /** sm | md | lg */
  size: { type: String, default: 'md' },
  /** 현재 별점과 같은 별을 다시 누르면 0으로 해제 */
  clearOnRepeat: { type: Boolean, default: true },
})

const emit = defineEmits(['change'])
const { t } = useI18n()

const STAR_SIZES = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-7 h-7',
}

function onSelect(star) {
  if (!props.interactive) return
  const next = props.clearOnRepeat && (props.rating || 0) === star ? 0 : star
  emit('change', next)
}
</script>

<template>
  <div class="inline-flex items-center" role="group" :aria-label="t('trackTable.rating')">
    <component
      :is="interactive ? 'button' : 'span'"
      v-for="star in 5"
      :key="star"
      :type="interactive ? 'button' : undefined"
      class="p-0.5 rounded-md"
      :class="interactive
        ? 'transition-transform hover:scale-110 active:scale-110 hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        : ''"
      @click="onSelect(star)"
    >
      <Star
        :class="[
          STAR_SIZES[size] || STAR_SIZES.md,
          star <= (rating || 0) ? 'fill-rating text-rating' : 'text-muted-foreground/35',
        ]"
      />
    </component>
  </div>
</template>
