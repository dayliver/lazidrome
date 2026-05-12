<script setup>
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import { usePlayerStore } from '@/stores/player'
import { useAuthStore } from '@/stores/auth'
import { getCoverUrl } from '@/lib/image'
import { playCount } from '@/lib/trackStats'
import { Button } from '@/components/ui/button'
import { ChevronRight } from 'lucide-vue-next'

const props = defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  tracks: { type: Array, default: () => [] },
  seeAllTo: { type: String, default: '/tracks' },
  seeAllLabel: { type: String, default: '전체 보기' },
})

const player = usePlayerStore()
const auth = useAuthStore()

const scrollEl = ref(null)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)

const coverSrc = (track) => {
  if (!track?.id) return ''
  return getCoverUrl(auth.serverUrl, 'track', track.id, auth.token)
}

const starLine = (rating) => {
  const r = Math.min(5, Math.max(0, Number(rating) || 0))
  return '★'.repeat(r) + '☆'.repeat(5 - r)
}

function updateScrollState() {
  const el = scrollEl.value
  if (!el) {
    canScrollLeft.value = false
    canScrollRight.value = false
    return
  }
  const { scrollLeft, clientWidth, scrollWidth } = el
  canScrollLeft.value = scrollLeft > 2
  canScrollRight.value = scrollLeft + clientWidth < scrollWidth - 2
}

function scrollPrev() {
  const el = scrollEl.value
  if (!el) return
  const step = Math.max(240, Math.floor(el.clientWidth * 0.72))
  el.scrollBy({ left: -step, behavior: 'smooth' })
}

function scrollNext() {
  const el = scrollEl.value
  if (!el) return
  const step = Math.max(240, Math.floor(el.clientWidth * 0.72))
  el.scrollBy({ left: step, behavior: 'smooth' })
}

const playAt = (index) => {
  const list = props.tracks.slice()
  if (!list.length) return
  const i = Math.min(Math.max(0, index), list.length - 1)
  void player.playList(list, i)
}

watch(
  () => props.tracks,
  () => {
    nextTick(() => {
      updateScrollState()
    })
  },
  { deep: true }
)

let ro
onMounted(() => {
  nextTick(() => {
    updateScrollState()
    const el = scrollEl.value
    if (el && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => updateScrollState())
      ro.observe(el)
    }
  })
})

onUnmounted(() => {
  ro?.disconnect()
})
</script>

<template>
  <section class="space-y-3 min-w-0">
    <div class="flex items-end justify-between gap-3 px-1">
      <div class="min-w-0">
        <h2 class="text-lg font-black tracking-tight text-foreground">{{ title }}</h2>
        <p v-if="description" class="text-sm text-muted-foreground mt-0.5 line-clamp-2">{{ description }}</p>
      </div>
      <Button variant="ghost" size="sm" class="shrink-0 gap-1 text-muted-foreground" as-child>
        <RouterLink :to="seeAllTo">
          {{ seeAllLabel }}
          <ChevronRight class="w-4 h-4" />
        </RouterLink>
      </Button>
    </div>

    <div
      v-if="tracks.length === 0"
      class="rounded-2xl border border-dashed border-border/60 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground"
    >
      표시할 곡이 없습니다.
    </div>

    <div v-else class="flex items-stretch gap-1.5 sm:gap-2 min-w-0">
      <button
        type="button"
        class="shelf-nav-btn shrink-0 w-9 sm:w-10 rounded-xl border border-border/60 bg-muted/40 hover:bg-muted/80 disabled:opacity-25 disabled:pointer-events-none flex items-center justify-center text-foreground transition-colors"
        :disabled="!canScrollLeft"
        aria-label="이전"
        @click="scrollPrev"
      >
        <span class="triangle triangle-left" aria-hidden="true" />
      </button>

      <div
        ref="scrollEl"
        class="shelf-scroll min-w-0 flex-1 flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-1"
        @scroll.passive="updateScrollState"
      >
        <button
          v-for="(track, index) in tracks"
          :key="track.id + '-' + index"
          type="button"
          class="snap-start shrink-0 w-[9.5rem] sm:w-40 text-left rounded-2xl border border-border/50 bg-card/80 hover:bg-card hover:border-primary/30 transition-all overflow-hidden group shadow-sm"
          @click="playAt(index)"
        >
          <div class="aspect-square bg-muted relative">
            <img
              v-if="coverSrc(track)"
              :src="coverSrc(track)"
              crossorigin="anonymous"
              class="w-full h-full object-cover"
              alt=""
              @error="(e) => (e.target.style.display = 'none')"
            />
            <div
              v-else
              class="w-full h-full flex items-center justify-center text-[10px] font-black text-muted-foreground"
            >
              LAZI
            </div>
            <div
              class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            >
              <span class="text-white text-xs font-bold uppercase tracking-wider">재생</span>
            </div>
          </div>
          <div class="p-2.5 space-y-0.5">
            <p class="text-xs font-bold leading-tight line-clamp-2 min-h-[2rem]">{{ track.title || 'Untitled' }}</p>
            <p class="text-[11px] text-muted-foreground line-clamp-1">{{ track.artist || '—' }}</p>
            <div class="flex items-center justify-between gap-1 pt-0.5 text-[10px] tabular-nums">
              <span class="text-muted-foreground">재생 {{ playCount(track) }}회</span>
              <span class="text-yellow-500 font-sans tracking-tighter shrink-0" :title="`${Number(track.rating) || 0}/5`">
                {{ starLine(track.rating) }}
              </span>
            </div>
          </div>
        </button>
      </div>

      <button
        type="button"
        class="shelf-nav-btn shrink-0 w-9 sm:w-10 rounded-xl border border-border/60 bg-muted/40 hover:bg-muted/80 disabled:opacity-25 disabled:pointer-events-none flex items-center justify-center text-foreground transition-colors"
        :disabled="!canScrollRight"
        aria-label="다음"
        @click="scrollNext"
      >
        <span class="triangle triangle-right" aria-hidden="true" />
      </button>
    </div>
  </section>
</template>

<style scoped>
.shelf-scroll {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.shelf-scroll::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.triangle {
  display: block;
  width: 0;
  height: 0;
}
.triangle-left {
  border-top: 7px solid transparent;
  border-bottom: 7px solid transparent;
  border-right: 11px solid currentColor;
  margin-left: -3px;
}
.triangle-right {
  border-top: 7px solid transparent;
  border-bottom: 7px solid transparent;
  border-left: 11px solid currentColor;
  margin-right: -3px;
}
</style>
