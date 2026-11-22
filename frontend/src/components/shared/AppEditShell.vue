<script setup>
import { ref, useId, watch } from 'vue'
import { useEventListener } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-vue-next'

const props = defineProps({
  open: { type: Boolean, default: true },
  title: { type: String, default: '' },
  /** max-w-md | max-w-5xl etc */
  panelClass: {
    type: String,
    default: 'bg-card w-full h-full sm:h-[85vh] sm:max-w-5xl sm:rounded-2xl sm:shadow-2xl sm:border-2 flex flex-col overflow-hidden',
  },
  showClose: { type: Boolean, default: true },
  teleport: { type: Boolean, default: false },
})

defineEmits(['close'])

const { t } = useI18n()
const titleId = useId()
const viewport = window.visualViewport
const viewportStyle = ref({})

function updateViewport() {
  if (!props.open || !viewport) return
  viewportStyle.value = {
    '--edit-viewport-height': `${viewport.height}px`,
    '--edit-viewport-top': `${viewport.offsetTop}px`,
  }
}

watch(() => props.open, updateViewport, { immediate: true })
useEventListener(viewport, ['resize', 'scroll'], updateViewport)
</script>

<template>
  <Teleport to="body" :disabled="!teleport">
    <div
      v-if="open"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm sm:p-4 max-sm:bottom-auto max-sm:top-[var(--edit-viewport-top,0px)] max-sm:h-[var(--edit-viewport-height,100dvh)]"
      :style="viewportStyle"
      @click.self="$emit('close')"
    >
      <div :class="panelClass" role="dialog" aria-modal="true" :aria-labelledby="title || $slots.title ? titleId : undefined">
        <header
          v-if="title || $slots.title || showClose"
          class="flex items-center justify-between px-4 sm:px-8 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:py-5 border-b bg-muted/20 shrink-0 gap-3"
        >
          <div :id="titleId" class="min-w-0">
            <slot name="title">
              <h2 v-if="title" class="text-xl sm:text-2xl font-black truncate">{{ title }}</h2>
            </slot>
          </div>
          <Button
            v-if="showClose"
            variant="ghost"
            size="icon"
            class="size-11 shrink-0 sm:size-9"
            :aria-label="t('common.close')"
            @click="$emit('close')"
          >
            <X class="w-5 h-5" />
          </Button>
        </header>

        <nav
          v-if="$slots.tabs"
          class="flex items-center border-b px-4 sm:px-8 gap-4 sm:gap-8 bg-muted/5 shrink-0 overflow-x-auto no-scrollbar"
        >
          <slot name="tabs" />
        </nav>

        <main class="flex-1 overflow-y-auto p-4 sm:p-8 relative min-h-0">
          <slot />
        </main>

        <footer
          v-if="$slots.footer"
          class="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-6 border-t bg-muted/20 flex items-center justify-between gap-3 shrink-0"
        >
          <slot name="footer" />
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
