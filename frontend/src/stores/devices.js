import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './auth'
import { getDeviceId } from '@/lib/deviceIdentity.js'

/**
 * 재생 기기 레지스트리 (GET/PATCH/DELETE /api/devices).
 * 통계 기기 필터와 설정의 기기 관리가 같은 목록을 공유한다.
 */
export const useDevicesStore = defineStore('devices', () => {
  const auth = useAuthStore()

  const devices = ref([])
  const unattributedPlays = ref(0)
  const loading = ref(false)
  const error = ref(null)
  let loadedOnce = false

  const thisDeviceId = computed(() => getDeviceId())

  const thisDevice = computed(
    () => devices.value.find((d) => String(d.id) === thisDeviceId.value) || null,
  )

  const excludedCount = computed(() => devices.value.filter((d) => d.exclude_from_stats).length)

  async function load({ force = false } = {}) {
    if (!auth.isAuthenticated) {
      devices.value = []
      unattributedPlays.value = 0
      return
    }
    if (loadedOnce && !force) return
    loading.value = true
    error.value = null
    try {
      const res = await auth.fetchWithAuth('/api/devices')
      if (!res.ok) throw new Error(res.statusText)
      const body = await res.json()
      devices.value = Array.isArray(body?.data?.devices) ? body.data.devices : []
      unattributedPlays.value = Number(body?.data?.unattributedPlays) || 0
      loadedOnce = true
    } catch (e) {
      console.error('기기 목록 조회 실패:', e)
      error.value = e
    } finally {
      loading.value = false
    }
  }

  /** @param {{ name?: string, excludeFromStats?: boolean }} patch */
  async function updateDevice(id, patch) {
    const res = await auth.fetchWithAuth(`/api/devices/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) throw new Error(res.statusText)
    const body = await res.json()
    const next = body?.data
    if (next) {
      const i = devices.value.findIndex((d) => String(d.id) === String(id))
      if (i !== -1) devices.value[i] = { ...devices.value[i], ...next }
    }
    return next
  }

  async function removeDevice(id) {
    const res = await auth.fetchWithAuth(`/api/devices/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
    if (!res.ok) throw new Error(res.statusText)
    devices.value = devices.value.filter((d) => String(d.id) !== String(id))
    await load({ force: true })
  }

  /**
   * 특정 기기의 재생 기록 삭제. from/to는 사용자 로컬 날짜(YYYY-MM-DD), 생략하면 전체.
   * @returns {Promise<{ deleted: number, affectedTracks: number }>}
   */
  async function purgePlays(id, { from = null, to = null, timezone } = {}) {
    const res = await auth.fetchWithAuth(
      `/api/devices/${encodeURIComponent(id)}/plays/purge`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, timezone }),
      },
    )
    if (!res.ok) throw new Error(res.statusText)
    const body = await res.json()
    await load({ force: true })
    return body?.data ?? { deleted: 0, affectedTracks: 0 }
  }

  return {
    devices,
    unattributedPlays,
    loading,
    error,
    thisDeviceId,
    thisDevice,
    excludedCount,
    load,
    updateDevice,
    removeDevice,
    purgePlays,
  }
})
