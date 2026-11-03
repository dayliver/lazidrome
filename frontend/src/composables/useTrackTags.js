import { ref } from 'vue'
import { useLibraryStore } from '@/stores/library'
import { useAuthStore } from '@/stores/auth'

const sharedAllTags = ref([])
let lastFetchAt = 0
const CACHE_MS = 60_000

export function useTrackTags() {
  const auth = useAuthStore()
  const library = useLibraryStore()
  const loading = ref(false)

  async function fetchTags({ force = false } = {}) {
    if (
      !force &&
      sharedAllTags.value.length > 0 &&
      Date.now() - lastFetchAt < CACHE_MS
    ) {
      return sharedAllTags.value
    }
    loading.value = true
    try {
      const res = await auth.fetchWithAuth('/api/tags')
      if (res.ok) {
        const body = await res.json()
        sharedAllTags.value = Array.isArray(body?.data) ? body.data : []
        lastFetchAt = Date.now()
      }
    } catch (err) {
      console.error('태그 목록 로드 실패:', err)
    } finally {
      loading.value = false
    }
    return sharedAllTags.value
  }

  function normalizeTagList(raw) {
    if (Array.isArray(raw)) return raw.map((t) => String(t))
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed.map((t) => String(t)) : []
      } catch {
        return []
      }
    }
    return []
  }

  function mergeTagCatalog(trackTags = []) {
    const names = normalizeTagList(trackTags)
    const byName = new Map(sharedAllTags.value.map((t) => [t.name, t]))
    for (const name of names) {
      if (!byName.has(name)) {
        byName.set(name, { name, count: 0, hasImage: false })
      }
    }
    return [...byName.values()]
  }

  function sortedTagsForTrack(trackTags = []) {
    const names = normalizeTagList(trackTags)
    const current = new Set(names)
    return mergeTagCatalog(names).sort((a, b) => {
      const aOn = current.has(a.name) ? 0 : 1
      const bOn = current.has(b.name) ? 0 : 1
      if (aOn !== bOn) return aOn - bOn
      if (b.count !== a.count) return b.count - a.count
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })
  }

  function ensureTrackTags(track) {
    if (!track) return []
    if (!Array.isArray(track.tags)) {
      track.tags = normalizeTagList(track.tags)
    }
    return track.tags
  }

  async function persistTags(track, tags) {
    const prev = [...ensureTrackTags(track)]
    const next = [...tags]
    track.tags = next
    try {
      await library.updateTrackTags(track.id, next)
    } catch (err) {
      track.tags = prev
      throw err
    }
  }

  async function setTag(track, tagName, enabled) {
    const name = String(tagName || '').trim()
    if (!name) return false
    const tags = [...ensureTrackTags(track)]
    const idx = tags.indexOf(name)
    const on = idx >= 0
    if (enabled === on) return false
    if (enabled) tags.push(name)
    else tags.splice(idx, 1)
    await persistTags(track, tags)
    if (enabled && !sharedAllTags.value.some((t) => t.name === name)) {
      sharedAllTags.value.push({ name, count: 1, hasImage: false })
    }
    return true
  }

  async function toggleTag(track, tagName) {
    const name = String(tagName || '').trim()
    if (!name) return false
    const on = ensureTrackTags(track).includes(name)
    return setTag(track, name, !on)
  }

  async function addTag(track, rawName) {
    return setTag(track, rawName, true)
  }

  return {
    allTags: sharedAllTags,
    loading,
    fetchTags,
    sortedTagsForTrack,
    setTag,
    toggleTag,
    addTag,
  }
}
