import { ref } from 'vue'

const DRAG_THRESHOLD_PX = 6

/** 스트립 안의 버튼·링크 등 — 드래그·포인터 캡처 제외 */
export function isHorizontalDragInteractiveTarget(e) {
  const el = e.target
  return el instanceof Element && !!el.closest('button, a, input, textarea, select, [role="button"]')
}

/**
 * 가로 overflow 영역을 마우스/포인터로 드래그해 스크롤합니다 (데스크톱 등).
 * 드래그로 움직였다면 직후 click은 무시하도록 `consumeClickIfSuppressed` 사용.
 */
export function useHorizontalDragScroll() {
  const elRef = ref(null)
  const suppressNextClick = ref(false)

  let suppressClearTimer = null

  let pointerDown = false
  let startClientX = 0
  let startScrollLeft = 0
  let dragMoved = false

  function clearSuppressLater() {
    if (suppressClearTimer != null) clearTimeout(suppressClearTimer)
    suppressClearTimer = setTimeout(() => {
      suppressNextClick.value = false
      suppressClearTimer = null
    }, 450)
  }

  function onPointerDown(e) {
    if (isHorizontalDragInteractiveTarget(e)) return
    const el = elRef.value
    if (!el || e.button !== 0) return
    pointerDown = true
    dragMoved = false
    startClientX = e.clientX
    startScrollLeft = el.scrollLeft
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  function onPointerMove(e) {
    const el = elRef.value
    if (!pointerDown || !el) return
    const dx = e.clientX - startClientX
    if (Math.abs(dx) > DRAG_THRESHOLD_PX) dragMoved = true
    if (dragMoved) el.scrollLeft = startScrollLeft - dx
  }

  function onPointerUp(e) {
    const el = elRef.value
    if (!el) return
    pointerDown = false
    if (dragMoved) {
      suppressNextClick.value = true
      clearSuppressLater()
    }
    dragMoved = false
    try {
      el.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  /** 자식 버튼 @click 에서 먼저 호출 — true면 재생 등 처리 건너뜀 */
  function consumeClickIfSuppressed(e) {
    if (!suppressNextClick.value) return false
    suppressNextClick.value = false
    if (suppressClearTimer != null) {
      clearTimeout(suppressClearTimer)
      suppressClearTimer = null
    }
    e.preventDefault()
    e.stopPropagation()
    return true
  }

  return {
    elRef,
    stripHandlers: {
      onPointerdown: onPointerDown,
      onPointermove: onPointerMove,
      onPointerup: onPointerUp,
      onPointercancel: onPointerUp,
    },
    consumeClickIfSuppressed,
  }
}
