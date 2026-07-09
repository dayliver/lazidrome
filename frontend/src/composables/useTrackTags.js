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

  function mergeTagCatalog(trackTags = []) {
    const byName = new Map(sharedAllTags.value.map((t) => [t.name, t]))
    for (const name of trackTags || []) {
      if (!byName.has(name)) {
        byName.set(name, { name, count: 0, hasImage: false })
      }
    }
    return [...byName.values()]
  }

  function sortedTagsForTrack(trackTags = []) {
    const current = new Set(trackTags || [])
    return mergeTagCatalog(trackTags).sort((a, b) => {
      const aOn = current.has(a.name) ? 0 : 1
      const bOn = current.has(b.name) ? 0 : 1
      if (aOn !== bOn) return aOn - bOn
      if (b.count !== a.count) return b.count - a.count
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })
  }

  function ensureTrackTags(track) {
    if (!Array.isArray(track.tags)) track.tags = []
    return track.tags
  }

  async function persistTags(track, tags) {
    const prev = [...ensureTrackTags(track)]
    track.tags = tags
    try {
      await library.updateTrackTags(track.id, tags)
    } catch (err) {
      track.tags = prev
      throw err
    }
  }

  async function toggleTag(track, tagName) {
    const tags = [...ensureTrackTags(track)]
    const idx = tags.indexOf(tagName)
    if (idx >= 0) tags.splice(idx, 1)
    else tags.push(tagName)
    await persistTags(track, tags)
    if (idx < 0 && !sharedAllTags.value.some((t) => t.name === tagName)) {
      sharedAllTags.value.push({ name: tagName, count: 1, hasImage: false })
    }
  }

  async function addTag(track, rawName) {
    const name = String(rawName || '').trim()
    if (!name) return false
    const tags = [...ensureTrackTags(track)]
    if (tags.includes(name)) return false
    tags.push(name)
    await persistTags(track, tags)
    if (!sharedAllTags.value.some((t) => t.name === name)) {
      sharedAllTags.value.push({ name, count: 1, hasImage: false })
    }
    return true
  }

  return {
    allTags: sharedAllTags,
    loading,
    fetchTags,
    sortedTagsForTrack,
    toggleTag,
    addTag,
  }
}
