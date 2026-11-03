import { ref } from 'vue'

export function useTrackContextMenu() {
  const open = ref(false)
  const anchorX = ref(0)
  const anchorY = ref(0)
  /** deep ref — 태그/즐겨찾기 등 중첩 필드 변경이 메뉴 UI에 바로 반영되게 */
  const contextTrack = ref(null)

  function openAt(event, track) {
    if (!track) return
    contextTrack.value = track
    const point = event.touches?.[0] ?? event
    anchorX.value = point.clientX
    anchorY.value = point.clientY
    open.value = true
  }

  function openFromTrigger(event, track) {
    if (!track) return
    const el = event.currentTarget
    const rect = el?.getBoundingClientRect?.()
    contextTrack.value = track
    if (rect) {
      anchorX.value = rect.right
      anchorY.value = rect.top
    } else {
      anchorX.value = event.clientX
      anchorY.value = event.clientY
    }
    open.value = true
  }

  return {
    open,
    anchorX,
    anchorY,
    contextTrack,
    openAt,
    openFromTrigger,
  }
}
