<script setup>
import { Button } from '@/components/ui/button'
import { X } from 'lucide-vue-next'

defineProps({
  open: { type: Boolean, default: true },
  title: { type: String, default: '' },
  /** max-w-md | max-w-5xl etc */
  panelClass: {
    type: String,
    default: 'bg-card w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl border-2 flex flex-col overflow-hidden',
  },
  showClose: { type: Boolean, default: true },
  teleport: { type: Boolean, default: false },
})

defineEmits(['close'])
</script>

<template>
  <Teleport to="body" :disabled="!teleport">
    <div
      v-if="open"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      @click.self="$emit('close')"
    >
      <div :class="panelClass" role="dialog" aria-modal="true">
        <header
          v-if="title || $slots.title || showClose"
          class="flex items-center justify-between px-6 sm:px-8 py-4 sm:py-5 border-b bg-muted/20 shrink-0 gap-3"
        >
          <div class="min-w-0">
            <slot name="title">
              <h2 v-if="title" class="text-xl sm:text-2xl font-black truncate">{{ title }}</h2>
            </slot>
          </div>
          <Button
            v-if="showClose"
            variant="ghost"
            size="icon"
            class="shrink-0"
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
          class="p-4 sm:p-6 border-t bg-muted/20 flex items-center justify-between gap-3 shrink-0"
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
