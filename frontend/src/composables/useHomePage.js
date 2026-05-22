import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useLibraryStore } from '@/stores/library'
import { useAuthStore } from '@/stores/auth'
import { usePlayerStore } from '@/stores/player'
import { usePlaylistStore } from '@/stores/playlist'
import { readFrequentVisits } from '@/lib/visitHistory'
import {
  useHorizontalDragScroll,
  isHorizontalDragInteractiveTarget,
} from '@/composables/useHorizontalDragScroll'
import { t } from '@/i18n/t'

function kindLabel(type) {
  const key = `visit.${type}`
  const msg = t(key)
  return msg !== key ? msg : type
}

export function useHomePage() {
  const library = useLibraryStore()
  const auth = useAuthStore()
  const player = usePlayerStore()
  const playlistStore = usePlaylistStore()
  const route = useRoute()

  const visits = ref([])
  const top20 = ref([])
  const topLoading = ref(false)
  const topError = ref(null)

  const refreshVisits = () => {
    visits.value = readFrequentVisits()
  }

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
      return null // 곡(track)은 상세 페이지 없음 — 기록·표시 안 함
    }
  }

  function resolveVisitName(v) {
    if (v.name && String(v.name).trim()) return String(v.name).trim()
    if (v.type === 'album') {
      const a = library.albums.find((x) => String(x.id) === String(v.id))
      return a?.name || t('visit.fallbackAlbum')
    }
    if (v.type === 'artist') {
      const a = library.artists.find((x) => String(x.id) === String(v.id))
      return a?.name || t('visit.fallbackArtist')
    }
    if (v.type === 'playlist') {
      const p = playlistStore.playlists.find((x) => String(x.id) === String(v.id))
      return p?.name || t('visit.fallbackPlaylist')
    }
  if (v.type === 'tag') return v.id
    return v.id
  }

  function visitCoverSrc(v) {
    if (!auth.token) return ''
    if (v.type === 'album') return auth.coverSrc('album', v.id)
    if (v.type === 'artist') return auth.coverSrc('artist', v.id)
  if (v.type === 'playlist') return auth.coverSrc('playlist', v.id)
    return ''
  }

  function visitImageType(v) {
    if (v.type === 'artist') return 'artist'
    if (v.type === 'album' || v.type === 'playlist') return 'album'
    return 'track'
  }

  const visitItems = computed(() =>
    visits.value.map((v) => ({
      ...v,
      kindLabel: kindLabel(v.type),
      displayName: resolveVisitName(v),
      to: visitTo(v),
      coverSrc: visitCoverSrc(v),
      imageType: visitImageType(v),
    }))
  )

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
      if (n === 'home') refreshVisits()
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

  const { elRef: topStripRef, stripHandlers: topStripDrag } = useHorizontalDragScroll()

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
    if (isHorizontalDragInteractiveTarget(e)) return
    topStripDrag.onPointerdown(e)
    pauseAutoUser.value = true
    if (resumeAfterInteractionTimer != null) {
      clearTimeout(resumeAfterInteractionTimer)
      resumeAfterInteractionTimer = null
    }
  }

  function stripPointerUp(e) {
    if (isHorizontalDragInteractiveTarget(e)) return
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
    if (isHorizontalDragInteractiveTarget(e)) return
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

  return {
    auth,
    visitItems,
    top20,
    topLoading,
    topError,
    visitRowClass,
    topStripRef,
    topStripBind,
    onStripMouseEnter,
    onStripMouseLeave,
    playTopFromIndex,
  }
}
