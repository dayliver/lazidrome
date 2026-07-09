<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Tag } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import TrackTagPickerPanel from '@/components/shared/TrackTagPickerPanel.vue'

const props = defineProps({
  track: { type: Object, default: null },
  size: { type: String, default: 'default' },
})

const { t } = useI18n()
const open = ref(false)

const tagCount = computed(() => (props.track?.tags || []).length)

const buttonClass = computed(() => {
  if (props.size === 'icon') {
    return 'h-12 w-12 rounded-full shrink-0'
  }
  return 'rounded-full gap-2 font-semibold'
})
</script>

<template>
  <Popover v-if="track" v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        variant="ghost"
        :size="size === 'icon' ? 'icon' : 'sm'"
        :class="buttonClass"
        :aria-label="t('player.editTags')"
      >
        <Tag class="w-5 h-5" :class="tagCount > 0 ? 'text-primary' : 'text-muted-foreground'" />
        <span v-if="size !== 'icon'">
          {{ t('trackTable.tags') }}
          <span v-if="tagCount > 0" class="text-muted-foreground">({{ tagCount }})</span>
        </span>
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-auto p-3" align="start" side="top">
      <TrackTagPickerPanel :track="track" :active="open" />
    </PopoverContent>
  </Popover>
</template>
