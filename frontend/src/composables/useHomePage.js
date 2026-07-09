import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useLibraryStore } from '@/stores/library'
import { useAuthStore } from '@/stores/auth'
import { usePlayerStore } from '@/stores/player'
import { usePlaybackSyncStore } from '@/stores/playbackSync.js'
import { usePlaylistStore } from '@/stores/playlist'
import { usePreferencesStore } from '@/stores/preferences'
import { fetchFrequentVisits, ensureLegacyVisitsDiscarded } from '@/lib/visitHistory'
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
  const playbackSync = usePlaybackSyncStore()
  const playlistStore = usePlaylistStore()
  const prefs = usePreferencesStore()
  const route = useRoute()

  const visits = ref([])
  const top20 = ref([])
  const topArtists = ref([])
  const topLoading = ref(false)
  const topError = ref(null)

  const refreshVisits = async () => {
    if (!auth.isAuthenticated) {
      visits.value = []
      return
    }
    try {
      visits.value = await fetchFrequentVisits()
    } catch {
      visits.value = []
    }
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
    case 'track':
      return { name: 'track-detail', params: { id: v.id } }
    default:
      return null
    }
  }

  function resolveVisitName(v) {
    if (v.name && String(v.name).trim()) return String(v.name).trim()
    if (v.type === 'playlist') {
      const p = playlistStore.playlists.find((x) => String(x.id) === String(v.id))
      return p?.name || ''
    }
    if (v.type === 'track') {
      const tr = library.tracks.find((x) => String(x.id) === String(v.id))
      return tr?.title || ''
    }
    if (v.type === 'tag') return v.id
    return ''
  }

  function visitCoverSrc(v) {
    if (!auth.token) return ''
    if (v.type === 'album') return auth.coverSrc('album', v.id)
    if (v.type === 'artist') return auth.coverSrc('artist', v.id)
    if (v.type === 'playlist') return auth.coverSrc('playlist', v.id)
    if (v.type === 'track') return auth.coverSrc('track', v.id)
    return ''
  }

  function visitImageType(v) {
    if (v.type === 'artist') return 'artist'
    if (v.type === 'album' || v.type === 'playlist') return 'album'
    if (v.type === 'track') return 'track'
    return 'track'
  }

  const visitItems = computed(() =>
    visits.value
      .map((v) => {
        const displayName = resolveVisitName(v)
        return {
          ...v,
          kindLabel: kindLabel(v.type),
          displayName,
          to: visitTo(v),
          coverSrc: visitCoverSrc(v),
          imageType: visitImageType(v),
        }
      })
      // 삭제된 엔티티: 서버 name이 비고 라이브러리에도 없으면 유령 카드로 숨김
      .filter((v) => v.type === 'tag' || (v.displayName && String(v.displayName).trim()))
  )

  const loadTop20 = async () => {
    if (!auth.isAuthenticated) {
      top20.value = []
      topArtists.value = []
      return
    }
    topLoading.value = true
    topError.value = null
    try {
      const data = await library.fetchStatsTop('7d', 20, prefs.effectiveTimezone)
      top20.value = Array.isArray(data?.tracks) ? data.tracks : []
      topArtists.value = Array.isArray(data?.artists) ? data.artists : []
    } catch (e) {
      console.error(e)
      topError.value = e
      top20.value = []
      topArtists.value = []
    } finally {
      topLoading.value = false
    }
  }

  const loadHome = async () => {
    if (!auth.isAuthenticated) return
    await ensureLegacyVisitsDiscarded()
    await playlistStore.fetchPlaylists()
    await refreshVisits()
    await loadTop20()
  }

  onMounted(() => {
    void loadHome()
  })

  watch(
    () => route.name,
    (n) => {
      if (n === 'home') void refreshVisits()
    }
  )

  watch(
    () => auth.token,
    (t) => {
      if (t) void loadHome()
      else {
        visits.value = []
        top20.value = []
        topArtists.value = []
      }
    }
  )

  watch(
    () => prefs.effectiveTimezone,
    () => {
      if (auth.isAuthenticated) void loadTop20()
    }
  )

  const playTopFromIndex = (indexInTop20) => {
    if (!top20.value.length || indexInTop20 < 0 || indexInTop20 >= top20.value.length) return
    void playbackSync.playTracks(top20.value, indexInTop20)
  }

  const { elRef: visitStripRef, stripHandlers: visitStripDrag } = useHorizontalDragScroll()
  const { elRef: topStripRef, stripHandlers: topStripDrag } = useHorizontalDragScroll()
  const { elRef: topArtistsStripRef, stripHandlers: topArtistsStripDrag } = useHorizontalDragScroll()

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

  const visitStripBind = {
    ...visitStripDrag,
  }

  const topArtistsStripBind = {
    ...topArtistsStripDrag,
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
    topArtists,
    topLoading,
    topError,
    visitStripRef,
    visitStripBind,
    topStripRef,
    topStripBind,
    topArtistsStripRef,
    topArtistsStripBind,
    onStripMouseEnter,
    onStripMouseLeave,
    playTopFromIndex,
  }
}
