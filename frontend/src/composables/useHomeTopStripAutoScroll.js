import { ref, watch, nextTick, onUnmounted } from 'vue'
import { isHorizontalDragInteractiveTarget } from '@/composables/useHorizontalDragScroll'

/**
 * Desktop hover auto-scroll for the home top-tracks strip.
 */
export function useHomeTopStripAutoScroll({ topStripRef, topStripDrag, itemCount }) {
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
      const count = typeof itemCount === 'function' ? itemCount() : itemCount?.value
      if (!el || !count || !stripHovered.value) return
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

  syncMediaRefs()
  reduceMotionQuery?.addEventListener('change', syncMediaRefs)
  mdUpQuery?.addEventListener('change', onMdUpMediaChange)

  watch(
    () => (typeof itemCount === 'function' ? itemCount() : itemCount?.value),
    () => scheduleRestartAutoScroll(),
    { flush: 'post' },
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

  onUnmounted(() => {
    reduceMotionQuery?.removeEventListener('change', syncMediaRefs)
    mdUpQuery?.removeEventListener('change', onMdUpMediaChange)
    stripResizeObserver?.disconnect()
    stripResizeObserver = null
    if (resumeAfterInteractionTimer != null) clearTimeout(resumeAfterInteractionTimer)
    stopTopStripAutoScroll()
  })

  return {
    topStripBind,
    onStripMouseEnter,
    onStripMouseLeave,
  }
}
