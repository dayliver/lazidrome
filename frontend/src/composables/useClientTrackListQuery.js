import { ref, computed, watch, toValue } from 'vue'
import {
  TRACK_SORT_PRESETS,
  applyTrackListQuery,
  isManualTrackListOrder,
  loadPersistedTrackListQuery,
  persistTrackListQuery,
  storageKeyForTrackListPreset,
} from '@/lib/trackListQuery'

const SEARCH_DEBOUNCE_MS = 320

/**
 * @param {import('vue').MaybeRefOrGetter<unknown[]>} sourceTracks
 * @param {'album' | 'artist' | 'tag' | 'playlist'} presetKey
 */
export function useClientTrackListQuery(sourceTracks, presetKey, { persist = true } = {}) {
  const preset = TRACK_SORT_PRESETS[presetKey]
  const storageKey = storageKeyForTrackListPreset(presetKey)
  const persisted = persist ? loadPersistedTrackListQuery(storageKey) : null

  const query = ref({
    ...preset.defaultQuery,
    ...(persisted ?? {}),
  })
  const searchInput = ref('')

  let searchTimer = null

  const sourceList = computed(() => {
    const raw = toValue(sourceTracks)
    return Array.isArray(raw) ? raw : []
  })

  const displayTracks = computed(() => applyTrackListQuery(sourceList.value, query.value))
  const total = computed(() => sourceList.value.length)
  const shown = computed(() => displayTracks.value.length)
  const isManualOrder = computed(() => isManualTrackListOrder(query.value))
  const sortOptions = preset.sortOptions

  const persistFilters = () => {
    if (!persist) return
    persistTrackListQuery(query.value, storageKey)
  }

  watch(
    () => [query.value.sort, query.value.order, query.value.starred, query.value.minRating],
    persistFilters,
  )

  watch(searchInput, (value) => {
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      const next = String(value ?? '').trim()
      if (next !== query.value.q) {
        query.value = { ...query.value, q: next }
      }
    }, SEARCH_DEBOUNCE_MS)
  })

  const setSort = (sort) => {
    query.value = { ...query.value, sort }
  }

  const toggleOrder = () => {
    query.value = {
      ...query.value,
      order: query.value.order === 'asc' ? 'desc' : 'asc',
    }
  }

  const setStarred = (starred) => {
    query.value = { ...query.value, starred: Boolean(starred) }
  }

  const toggleStarredFilter = () => {
    query.value = { ...query.value, starred: !query.value.starred }
  }

  const setMinRating = (minRating) => {
    const next = minRating == null || minRating === '' ? null : Number(minRating)
    query.value = {
      ...query.value,
      minRating: query.value.minRating === next ? null : next,
    }
  }

  const resetFilters = () => {
    searchInput.value = ''
    query.value = {
      ...query.value,
      q: '',
      starred: false,
      minRating: null,
    }
  }

  return {
    query,
    searchInput,
    displayTracks,
    total,
    shown,
    isManualOrder,
    sortOptions,
    setSort,
    toggleOrder,
    setStarred,
    toggleStarredFilter,
    setMinRating,
    resetFilters,
  }
}
