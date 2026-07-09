<script setup>
import { computed, nextTick, watch } from 'vue'
import { useVirtualList } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { usePlayerPresentation } from '@/composables/usePlayerPresentation.js'

const { t } = useI18n()
const auth = useAuthStore()
const {
  displayQueue,
  currentIndex,
  isQueueView,
  playAtIndex,
  remoteQueueLoading,
  isRemote,
} = usePlayerPresentation()

const trackCoverSrc = (track) => {
  if (!track?.id) return ''
  return auth.coverSrc('track', track.id)
}

const queueItems = computed(() => displayQueue.value ?? [])

const { list, containerProps, wrapperProps } = useVirtualList(queueItems, {
  itemHeight: 72,
  overscan: 6,
})

watch(() => isQueueView.value, (isOpen) => {
  if (isOpen) {
    nextTick(() => {
      const activeItem = document.querySelector('.queue-item-active')
      if (activeItem) activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }
})
</script>

<template>
  <div class="w-full h-full flex flex-col overflow-hidden bg-background/50 backdrop-blur-md rounded-xl border border-border/60 shadow-2xl min-h-0">
    <div class="p-6 border-b border-border/60 flex justify-between items-center bg-muted/20 shrink-0">
      <h3 class="font-black text-xl tracking-tighter uppercase">{{ t('player.upNext') }}</h3>
      <span class="text-xs font-bold text-muted-foreground bg-muted px-2 py-1 rounded-md">
        {{ t('player.queueTrackCount', { count: displayQueue.length }) }}
      </span>
    </div>

    <p v-if="isRemote && remoteQueueLoading" class="px-6 py-4 text-sm text-muted-foreground">
      {{ t('player.remoteQueueLoading') }}
    </p>

    <div v-bind="containerProps" class="flex-1 min-h-0 px-2 scroll-smooth">
      <div v-bind="wrapperProps" class="py-4">
        <div
          v-for="{ data: track, index } in list"
          :key="`${track.id}-${index}`"
          class="group flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all hover:bg-muted/60 active:scale-[0.98]"
          :class="{ 'queue-item-active bg-primary/20': currentIndex === index }"
          @click="playAtIndex(index)"
        >
          <div class="w-6 text-center text-xs font-mono font-bold text-muted-foreground">
            <span v-if="currentIndex !== index" class="group-hover:hidden">{{ index + 1 }}</span>
            <div v-else class="flex justify-center gap-[2px] h-3 items-end">
              <div class="w-1 bg-primary animate-[bounce_1s_infinite_0s]" />
              <div class="w-1 bg-primary animate-[bounce_1s_infinite_0.2s]" />
              <div class="w-1 bg-primary animate-[bounce_1s_infinite_0.4s]" />
            </div>
          </div>

          <div class="w-12 h-12 rounded-lg overflow-hidden border border-border/50 bg-muted shrink-0">
            <img
              v-if="trackCoverSrc(track)"
              :src="trackCoverSrc(track)"
              crossorigin="anonymous"
              loading="lazy"
              class="w-full h-full object-cover"
            />
            <div v-else class="w-full h-full flex items-center justify-center text-[10px] font-black opacity-20">
              {{ t('app.short') }}
            </div>
          </div>

          <div class="flex flex-col min-w-0 flex-1">
            <span class="text-sm font-bold truncate" :class="currentIndex === index ? 'text-primary' : ''">
              {{ track.title || t('player.unknownTrack') }}
            </span>
            <span class="text-xs text-muted-foreground truncate font-medium">
              {{ track.artist || track.primary_artist || t('common.unknownArtist') }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes bounce {
  0%, 100% { height: 4px; }
  50% { height: 12px; }
}
</style>
