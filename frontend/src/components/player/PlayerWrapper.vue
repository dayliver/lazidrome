<script setup>
import { ref, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { usePlaybackSyncStore } from '@/stores/playbackSync.js'
import MiniPlayer from './MiniPlayer.vue'

const FullPlayer = defineAsyncComponent(() => import('./FullPlayer.vue'))

const props = defineProps({
  isSidebarExpanded: { type: Boolean, default: true }
})

const player = usePlayerStore()
const sync = usePlaybackSyncStore()

const isMobile = ref(false)
const isReady = ref(false) // 💡 목적지 준비 상태를 체크할 변수 추가

const checkMobile = () => { isMobile.value = window.innerWidth < 768 }

/** Space 기본 동작을 유지할 대상: Input(텍스트류)·Textarea·Checkbox·Radio·Select·콤보박스·편집 영역만 (button 등은 제외) */
const SPACE_NATIVE_INPUT_TYPES = new Set([
  'text', 'password', 'search', 'email', 'url', 'tel',
  'number', 'date', 'datetime-local', 'month', 'week', 'time',
  '' // type 생략 시 text
])

function spaceToggleIgnoredTarget (target) {
  if (!target || !(target instanceof Element)) return false
  if (target.closest('[contenteditable="true"], [contenteditable="plaintext-only"]')) return true
  if (target.closest('textarea, select')) return true
  // 커스텀 Select / 자동완성 등 (ARIA 콤보박스는 보통 Space로 목록 열기)
  if (target.closest('[role="combobox"]')) return true

  const input = target.closest('input')
  if (input) {
    const type = (input.getAttribute('type') || 'text').toLowerCase()
    if (type === 'checkbox' || type === 'radio') return true
    if (SPACE_NATIVE_INPUT_TYPES.has(type)) return true
    return false
  }

  if (target.closest('[role="checkbox"], [role="radio"], [role="textbox"], [role="searchbox"]')) return true
  return false
}

function onGlobalKeydown (e) {
  if (e.code !== 'Space' && e.key !== ' ') return
  if (e.repeat) return
  if (spaceToggleIgnoredTarget(e.target)) return
  if (!sync.displayTrack) return
  e.preventDefault()
  sync.remoteTogglePlay()
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  window.addEventListener('keydown', onGlobalKeydown)

  // 💡 컴포넌트가 마운트되고 DOM이 그려진 후 순간이동 활성화
  isReady.value = true
})
onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
  window.removeEventListener('keydown', onGlobalKeydown)
})
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