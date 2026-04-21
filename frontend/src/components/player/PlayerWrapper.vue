<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '@/stores/player'
import MiniPlayer from './MiniPlayer.vue'
import FullPlayer from './FullPlayer.vue'

const props = defineProps({
  isSidebarExpanded: { type: Boolean, default: true }
})

const player = usePlayerStore()

const isMobile = ref(false)
const isReady = ref(false) // 💡 목적지 준비 상태를 체크할 변수 추가

const checkMobile = () => { isMobile.value = window.innerWidth < 768 }

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  
  // 💡 컴포넌트가 마운트되고 DOM이 그려진 후 순간이동 활성화
  isReady.value = true 
})
onUnmounted(() => window.removeEventListener('resize', checkMobile))
</script>

<template>
  <div>
    <Teleport to="#desktop-player-portal" :disabled="isMobile" v-if="isReady">
      <div 
        class="transition-opacity duration-300 w-full"
        :class="{ 'opacity-0 pointer-events-none': player.isExpanded }"
      >
        <MiniPlayer :is-sidebar-expanded="isSidebarExpanded" />
      </div>
    </Teleport>

    <Transition name="slide-up">
      <div v-if="player.isExpanded" class="fixed inset-0 bg-background z-[200] overflow-hidden">
        <FullPlayer />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.slide-up-enter-active, .slide-up-leave-active { transition: transform 0.5s cubic-bezier(0.32, 0.72, 0, 1); }
.slide-up-enter-from, .slide-up-leave-to { transform: translateY(100%); }
</style>