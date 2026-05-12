<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useLibraryStore } from '@/stores/library'
import { useAuthStore } from '@/stores/auth'
import { usePlayerStore } from '@/stores/player'
import { usePlaylistStore } from '@/stores/playlist'
import ViewHeader from '@/components/shared/ViewHeader.vue'
import { Button } from '@/components/ui/button'
import SafeImage from '@/components/shared/SafeImage.vue'
import { getCoverUrl } from '@/lib/image'
import { playCount } from '@/lib/trackStats'
import { readFrequentVisits } from '@/lib/visitHistory'
import { useHorizontalDragScroll } from '@/composables/useHorizontalDragScroll'

const library = useLibraryStore()
const auth = useAuthStore()
const player = usePlayerStore()
const playlistStore = usePlaylistStore()
const route = useRoute()

const visits = ref([])
const top20 = ref([])
const topLoading = ref(false)
const topError = ref(null)

const KIND_LABEL = {
  playlist: '플레이리스트',
  album: '앨범',
  artist: '아티스트',
  track: '곡',
  tag: '태그',
}

const refreshVisits = () => {
  visits.value = readFrequentVisits()
}

const visitItems = computed(() =>
  visits.value.map((v) => ({
    ...v,
    kindLabel: KIND_LABEL[v.type] || v.type,
    displayName: resolveVisitName(v),
    to: visitTo(v),
    coverSrc: visitCoverSrc(v),
    imageType: visitImageType(v),
  }))
)

function visitTo(v) {
  switch (v.type) {
    case 'playlist':
      return { name: 'playlist-detail', params: { id: v.id } }
    case 'album':
      return { name: 'album-detail', params: { id: v.id } }
    case 'artist':
      return { name: 'artist-detail', params: { id: v.id } }
    case 'tag':
      return { name: 'tag-detail', params: { name: v.id } }
    default:
      return null
  }
}

function resolveVisitName(v) {
  if (v.name && String(v.name).trim()) return String(v.name).trim()
  if (v.type === 'album') {
    const a = library.albums.find((x) => String(x.id) === String(v.id))
    return a?.name || '앨범'
  }
  if (v.type === 'artist') {
    const a = library.artists.find((x) => String(x.id) === String(v.id))
    return a?.name || '아티스트'
  }
  if (v.type === 'playlist') {
    const p = playlistStore.playlists.find((x) => String(x.id) === String(v.id))
    return p?.name || '플레이리스트'
  }
  if (v.type === 'track') {
    const t = library.tracks.find((x) => String(x.id) === String(v.id))
    return t?.title || '곡'
  }
  if (v.type === 'tag') return v.id
  return v.id
}

function visitCoverSrc(v) {
  if (!auth.token) return ''
  if (v.type === 'album') return getCoverUrl(auth.serverUrl, 'album', v.id, auth.token)
  if (v.type === 'artist') return getCoverUrl(auth.serverUrl, 'artist', v.id, auth.token)
  if (v.type === 'track') return getCoverUrl(auth.serverUrl, 'track', v.id, auth.token)
  if (v.type === 'playlist') return getCoverUrl(auth.serverUrl, 'playlist', v.id, auth.token)
  return ''
}

function visitImageType(v) {
  if (v.type === 'artist') return 'artist'
  if (v.type === 'album' || v.type === 'playlist') return 'album'
  return 'track'
}

const loadTop20 = async () => {
  if (!auth.isAuthenticated) {
    top20.value = []
    return
  }
  topLoading.value = true
  topError.value = null
  try {
    const data = await library.fetchStatsTop('7d', 20)
    top20.value = Array.isArray(data?.tracks) ? data.tracks : []
  } catch (e) {
    console.error(e)
    topError.value = e
    top20.value = []
  } finally {
    topLoading.value = false
  }
}

const loadHome = async () => {
  if (!auth.isAuthenticated) return
  await library.fetchLibrary()
  await playlistStore.fetchPlaylists()
  refreshVisits()
  await loadTop20()
}

onMounted(() => {
  void loadHome()
})

watch(
  () => route.name,
  (n) => {
    if (n === 'home') {
      refreshVisits()
    }
  }
)

watch(
  () => auth.token,
  (t) => {
    if (t) void loadHome()
    else {
      visits.value = []
      top20.value = []
    }
  }
)

const playTopFromIndex = (indexInTop20) => {
  if (!top20.value.length || indexInTop20 < 0 || indexInTop20 >= top20.value.length) return
  void player.playList(top20.value, indexInTop20)
}

const playVisitTrack = (id) => {
  const t = library.tracks.find((x) => String(x.id) === String(id))
  if (t) void player.playNewQueue([t], 0)
}

const visitRowClass =
  'flex w-full items-center gap-3 rounded-xl border border-border bg-card/60 px-3 py-2.5 transition-colors hover:bg-muted/50'

const { elRef: topStripRef, stripHandlers: topStripDrag, consumeClickIfSuppressed } =
  useHorizontalDragScroll()

const reduceMotionQuery =
  typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
const mdUpQuery = typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)') : null

const prefersReducedMotion = ref(false)
const viewportMdUp = ref(false)

function syncMediaRefs() {
  prefersReducedMotion.value = !!reduceMotionQuery?.matches
  viewportMdUp.value = !!mdUpQuery?.matches
}

const AUTO_RESUME_MS = 720
/** 호버 시에만 천천히 움직임 (기본은 고정) */
const AUTO_SCROLL_PX_PER_MS = 0.028

let autoScrollRaf = null
let autoScrollLastTs = 0
let autoScrollDir = 1
let resumeAfterInteractionTimer = null
let stripResizeObserver = null

const stripHovered = ref(false)
const pauseAutoUser = ref(false)

function stopTopStripAutoScroll() {
  if (autoScrollRaf != null) {
    cancelAnimationFrame(autoScrollRaf)
    autoScrollRaf = null
  }
}

function topStripAutoTick(ts) {
  autoScrollRaf = requestAnimationFrame(topStripAutoTick)
  const el = topStripRef.value
  if (!el) return

  const maxScroll = el.scrollWidth - el.clientWidth
  if (maxScroll <= 2) {
    autoScrollLastTs = ts
    return
  }

  if (
    prefersReducedMotion.value ||
    !viewportMdUp.value ||
    pauseAutoUser.value ||
    !stripHovered.value ||
    (typeof document !== 'undefined' && document.visibilityState === 'hidden')
  ) {
    autoScrollLastTs = ts
    return
  }

  const dt = Math.min(48, ts - (autoScrollLastTs || ts))
  autoScrollLastTs = ts
  el.scrollLeft += autoScrollDir * AUTO_SCROLL_PX_PER_MS * dt

  if (el.scrollLeft >= maxScroll - 0.5) {
    el.scrollLeft = maxScroll
    autoScrollDir = -1
  } else if (el.scrollLeft <= 0.5) {
    el.scrollLeft = 0
    autoScrollDir = 1
  }
}

function startTopStripAutoScroll() {
  stopTopStripAutoScroll()
  autoScrollLastTs = 0
  autoScrollDir = 1
  autoScrollRaf = requestAnimationFrame(topStripAutoTick)
}

function scheduleRestartAutoScroll() {
  nextTick(() => {
    stopTopStripAutoScroll()
    const el = topStripRef.value
    if (!el || !top20.value.length || !stripHovered.value) return
    const maxScroll = el.scrollWidth - el.clientWidth
    if (maxScroll <= 2) return
    startTopStripAutoScroll()
  })
}

function onStripMouseEnter() {
  stripHovered.value = true
  scheduleRestartAutoScroll()
}

function onStripMouseLeave() {
  stripHovered.value = false
  stopTopStripAutoScroll()
}

function stripPointerDown(e) {
  topStripDrag.onPointerdown(e)
  pauseAutoUser.value = true
  if (resumeAfterInteractionTimer != null) {
    clearTimeout(resumeAfterInteractionTimer)
    resumeAfterInteractionTimer = null
  }
}

function stripPointerUp(e) {
  topStripDrag.onPointerup(e)
  if (resumeAfterInteractionTimer != null) clearTimeout(resumeAfterInteractionTimer)
  resumeAfterInteractionTimer = setTimeout(() => {
    pauseAutoUser.value = false
    resumeAfterInteractionTimer = null
    autoScrollLastTs = 0
    scheduleRestartAutoScroll()
  }, AUTO_RESUME_MS)
}

function stripPointerCancel(e) {
  topStripDrag.onPointercancel(e)
  if (resumeAfterInteractionTimer != null) clearTimeout(resumeAfterInteractionTimer)
  resumeAfterInteractionTimer = setTimeout(() => {
    pauseAutoUser.value = false
    resumeAfterInteractionTimer = null
    autoScrollLastTs = 0
    scheduleRestartAutoScroll()
  }, AUTO_RESUME_MS)
}

const topStripBind = {
  ...topStripDrag,
  onPointerdown: stripPointerDown,
  onPointerup: stripPointerUp,
  onPointercancel: stripPointerCancel,
}

function onTopCardClick(e, idx) {
  if (consumeClickIfSuppressed(e)) return
  playTopFromIndex(idx)
}

function onMdUpMediaChange() {
  syncMediaRefs()
  scheduleRestartAutoScroll()
}

function setupTopStripObservers() {
  syncMediaRefs()
  reduceMotionQuery?.addEventListener('change', syncMediaRefs)
  mdUpQuery?.addEventListener('change', onMdUpMediaChange)

  watch(
    () => top20.value.length,
    () => scheduleRestartAutoScroll(),
    { flush: 'post' }
  )

  watch(topStripRef, (el) => {
    stripResizeObserver?.disconnect()
    stripResizeObserver = null
    if (!el) {
      stopTopStripAutoScroll()
      return
    }
    stripResizeObserver = new ResizeObserver(() => {
      const strip = topStripRef.value
      if (!strip) return
      const maxScroll = strip.scrollWidth - strip.clientWidth
      if (strip.scrollLeft > maxScroll) strip.scrollLeft = Math.max(0, maxScroll)
      scheduleRestartAutoScroll()
    })
    stripResizeObserver.observe(el)
    scheduleRestartAutoScroll()
  })
}

setupTopStripObservers()

onUnmounted(() => {
  reduceMotionQuery?.removeEventListener('change', syncMediaRefs)
  mdUpQuery?.removeEventListener('change', onMdUpMediaChange)
  stripResizeObserver?.disconnect()
  stripResizeObserver = null
  if (resumeAfterInteractionTimer != null) clearTimeout(resumeAfterInteractionTimer)
  stopTopStripAutoScroll()
})
</script>

<template>
  <div class="w-full space-y-10">
    <div class="space-y-2 mb-2">
      <ViewHeader
        title="Home"
        description="자주 연 페이지와 최근 일주일 인기 곡만 모았습니다."
        :show-action="false"
      />
      <div v-if="auth.isAuthenticated" class="flex justify-end">
        <RouterLink
          to="/stats"
          class="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
        >
          상세 통계
        </RouterLink>
      </div>
    </div>

    <div
      v-if="!auth.isAuthenticated"
      class="rounded-2xl border border-border bg-card/50 p-8 text-center space-y-4"
    >
      <p class="text-muted-foreground">로그인하면 홈이 채워집니다.</p>
      <Button as-child>
        <RouterLink to="/settings">설정으로 이동</RouterLink>
      </Button>
    </div>

    <template v-else>
      <section class="space-y-3">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">자주 찾은 항목</h2>
        <p v-if="!visitItems.length" class="text-sm text-muted-foreground py-2">
          플레이리스트·앨범·아티스트 등을 둘러보면 여기에 쌓입니다.
        </p>
        <ul v-else class="flex flex-col gap-2">
          <li v-for="v in visitItems" :key="`${v.type}-${v.id}`">
            <RouterLink v-if="v.to" :to="v.to" :class="visitRowClass">
              <SafeImage
                v-if="v.type !== 'tag'"
                :src="v.coverSrc"
                :type="v.imageType"
                class="h-10 w-10 shrink-0 rounded-md ring-1 ring-border"
              />
              <div
                v-else
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-bold text-muted-foreground"
              >
                #
              </div>
              <div class="min-w-0 flex-1 text-left">
                <p class="truncate text-sm font-medium">{{ v.displayName }}</p>
                <p class="text-xs text-muted-foreground">{{ v.kindLabel }} · 방문 {{ v.count }}회</p>
              </div>
            </RouterLink>
            <button
              v-else
              type="button"
              :class="[visitRowClass, 'text-left']"
              @click="playVisitTrack(v.id)"
            >
              <SafeImage
                :src="v.coverSrc"
                :type="v.imageType"
                class="h-10 w-10 shrink-0 rounded-md ring-1 ring-border"
              />
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium">{{ v.displayName }}</p>
                <p class="text-xs text-muted-foreground">{{ v.kindLabel }} · 방문 {{ v.count }}회</p>
              </div>
            </button>
          </li>
        </ul>
      </section>

      <section class="space-y-3">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          최근 7일 많이 재생된 곡
        </h2>
        <p class="text-xs text-muted-foreground leading-relaxed">
          곡을 누르면 같은 순위의 상위 20곡이 대기열에 올라가고, 누른 곡부터 재생됩니다.
        </p>

        <div v-if="topLoading && !top20.length" class="flex items-center gap-3 py-6 text-sm text-muted-foreground">
          <div class="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          불러오는 중…
        </div>
        <div
          v-else-if="topError"
          class="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          순위 데이터를 불러오지 못했습니다.
        </div>
        <p v-else-if="!top20.length" class="text-sm text-muted-foreground py-4">아직 기록이 없습니다.</p>
        <template v-else>
          <!-- 모바일: 세로 5곡 -->
          <ul class="flex flex-col gap-2 md:hidden">
            <li v-for="(track, idx) in top20.slice(0, 5)" :key="track.id">
              <button
                type="button"
                class="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                @click="playTopFromIndex(idx)"
              >
                <div class="relative h-14 w-14 shrink-0">
                  <SafeImage
                    :src="getCoverUrl(auth.serverUrl, 'track', track.id, auth.token)"
                    type="track"
                    class="h-14 w-14 rounded-lg ring-1 ring-border"
                  />
                  <span
                    class="pointer-events-none absolute left-1 top-1 z-10 rounded bg-black/60 px-1 py-px text-[9px] font-bold tabular-nums text-white shadow-sm ring-1 ring-white/20 backdrop-blur-[1px]"
                  >
                    {{ playCount(track) }}회
                  </span>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-semibold">{{ track.title }}</p>
                  <p class="truncate text-xs text-muted-foreground">{{ track.artist || '—' }}</p>
                </div>
              </button>
            </li>
          </ul>

          <!-- md 이상: 가로로 최대 20곡, 스크롤바 숨김 -->
          <div
            class="hidden md:block w-[calc(100%+2rem)] max-w-none -mx-4 md:w-[calc(100%+6rem)] md:-mx-12"
          >
            <div
              ref="topStripRef"
              class="home-top-strip flex gap-3 overflow-x-auto px-4 pb-1 md:gap-4 md:px-12 cursor-grab active:cursor-grabbing touch-pan-x select-none"
              v-bind="topStripBind"
              @mouseenter="onStripMouseEnter"
              @mouseleave="onStripMouseLeave"
            >
              <button
                v-for="(track, idx) in top20"
                :key="track.id"
                type="button"
                class="flex w-[clamp(7.5rem,11vw,10.5rem)] shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition-all hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-[clamp(7.5rem,9vw,11rem)]"
                @click="onTopCardClick($event, idx)"
              >
                <div class="relative aspect-square w-full overflow-hidden bg-muted">
                  <SafeImage
                    :src="getCoverUrl(auth.serverUrl, 'track', track.id, auth.token)"
                    type="track"
                    class="aspect-square h-full w-full object-cover"
                  />
                  <span
                    class="pointer-events-none absolute left-2 top-2 z-10 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white shadow-sm ring-1 ring-white/20 backdrop-blur-sm"
                  >
                    {{ playCount(track) }}회
                  </span>
                </div>
                <div class="space-y-0.5 p-2">
                  <p class="line-clamp-2 text-xs font-semibold leading-snug">{{ track.title }}</p>
                  <p class="line-clamp-1 text-[11px] text-muted-foreground">{{ track.artist || '—' }}</p>
                </div>
              </button>
            </div>
          </div>
        </template>
      </section>
    </template>
  </div>
</template>

<style scoped>
.home-top-strip {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.home-top-strip::-webkit-scrollbar {
  display: none;
}
</style>
