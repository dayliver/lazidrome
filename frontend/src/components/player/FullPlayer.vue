<script setup>
import { useI18n } from 'vue-i18n'
import { ArrowLeft } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import QueueList from './QueueList.vue'
import FullPlayerHeader from './FullPlayerHeader.vue'
import FullPlayerNowPlaying from './FullPlayerNowPlaying.vue'
import { usePlayerPresentation } from '@/composables/usePlayerPresentation.js'

const { t } = useI18n()
const { player, coverUrl, isQueueView, toggleQueueView } = usePlayerPresentation()
</script>

<template>
  <div class="relative w-full h-full flex flex-col bg-background text-foreground overflow-hidden">
    <div class="absolute inset-0 z-0 pointer-events-none">
      <img
        v-if="coverUrl"
        :src="coverUrl"
        crossorigin="anonymous"
        class="w-full h-full object-cover blur-[100px] opacity-10 saturate-[0.5] scale-125"
      />
      <div class="absolute inset-0 bg-gradient-to-b from-background/20 via-background/80 to-background" />
    </div>

    <div class="relative z-10 flex flex-col h-full w-full">
      <FullPlayerHeader @close="player.toggleExpand()" />

      <main class="flex-1 flex flex-col items-stretch justify-center px-4 sm:px-6 md:px-12 max-w-6xl lg:max-w-7xl mx-auto w-full min-h-0 overflow-y-auto overflow-x-hidden pb-8 md:pb-12">
        <div class="w-full flex-1 flex flex-col justify-center min-h-0 py-2 md:py-4">
          <Transition name="slide-fade" mode="out-in">
            <FullPlayerNowPlaying v-if="!isQueueView" />

            <div v-else class="flex flex-col h-full max-h-[500px] md:max-h-[600px] w-full relative min-h-0">
              <QueueList class="flex-1 min-h-0" />
              <Button
                variant="secondary"
                class="mt-4 rounded-full w-full py-6 font-black gap-2 border shadow-lg active:scale-95 transition-transform shrink-0"
                @click="toggleQueueView()"
              >
                <ArrowLeft class="w-4 h-4" />
                <span>{{ t('player.backToPlayer').toUpperCase() }}</span>
              </Button>
            </div>
          </Transition>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
:deep(.relative.h-1\.5) { height: 8px; }
:deep([role="slider"]) { width: 18px; height: 18px; border: 4px solid white; }

h2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.slide-fade-enter-active, .slide-fade-leave-active { transition: all 0.3s ease-out; }
.slide-fade-enter-from { opacity: 0; transform: translateX(20px); }
.slide-fade-leave-to { opacity: 0; transform: translateX(-20px); }

.fade-scale-enter-active, .fade-scale-leave-active { transition: all 0.5s ease; }
.fade-scale-enter-from, .fade-scale-leave-to { opacity: 0; scale: 0.9; }
</style>
