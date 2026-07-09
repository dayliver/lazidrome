import { ref, watch, onMounted, computed, toValue } from 'vue'
import { useLibraryStore } from '@/stores/library'
import {
  TRACK_SORT_PRESETS,
  loadPersistedTrackListQuery,
  persistTrackListQuery,
  storageKeyForTrackListPreset,
} from '@/lib/trackListQuery'

const SEARCH_DEBOUNCE_MS = 320

function sortsFromDetailQuery(query) {
  if (!query?.sort || query.sort === 'manual') return ''
  return `${query.sort}:${query.order === 'asc' ? 'asc' : 'desc'}`
}

/**
 * 상세(아티스트·앨범) 트랙 목록 — /api/tracks scoped filter + 페이지네이션.
 * @param {import('vue').MaybeRefOrGetter<{ artistId?: string, albumId?: string }>} scope
 */
export function useScopedTracksPageQuery(scope, { presetKey = 'artist', limit = 50 } = {}) {
  const library = useLibraryStore()
  const preset = TRACK_SORT_PRESETS[presetKey]
  const storageKey = storageKeyForTrackListPreset(presetKey)
  const persisted = loadPersistedTrackListQuery(storageKey)

  const query = ref({
    ...preset.defaultQuery,
    starred: persisted?.starred ?? false,
    minRating: persisted?.minRating ?? null,
  })
  const searchInput = ref('')

  const tracks = ref([])
  const total = ref(0)
  const offset = ref(0)
  const hasMore = ref(true)
  const isLoading = ref(false)
  const isLoadMore = ref(false)

  let searchTimer = null
  let loadGeneration = 0

  const sortOptions = preset.sortOptions

  const persistFilters = () => {
    persistTrackListQuery(
      {
        sorts: [],
        starred: query.value.starred,
        minRating: query.value.minRating,
      },
      storageKey,
    )
  }

  const scopeParams = () => {
    const s = toValue(scope) ?? {}
    return {
      artistId: s.artistId ? String(s.artistId) : undefined,
      albumId: s.albumId ? String(s.albumId) : undefined,
    }
  }

  const loadTracks = async (append = false) => {
    const { artistId, albumId } = scopeParams()
    if (!artistId && !albumId) {
      tracks.value = []
      total.value = 0
      hasMore.value = false
      return
    }

    const generation = ++loadGeneration
    if (!append) isLoading.value = true
    else isLoadMore.value = true

    try {
      const page = await library.fetchTracksPage({
        offset: offset.value,
        limit,
        sorts: sortsFromDetailQuery(query.value),
        q: query.value.q,
        starred: query.value.starred,
        minRating: query.value.minRating,
        artistId,
        albumId,
      })

      if (generation !== loadGeneration) return

      total.value = page.total
      hasMore.value = page.hasMore

      if (append) {
        tracks.value = [...tracks.value, ...page.items]
      } else {
        tracks.value = page.items
      }
    } catch (error) {
      if (generation !== loadGeneration) return
      console.error(error)
      if (!append) tracks.value = []
      hasMore.value = false
    } finally {
      if (generation === loadGeneration) {
        isLoading.value = false
        isLoadMore.value = false
      }
    }
  }

  const reload = async () => {
    offset.value = 0
    hasMore.value = true
    await loadTracks(false)
  }

  const loadMore = async () => {
    if (!hasMore.value || isLoadMore.value || isLoading.value) return
    offset.value += limit
    await loadTracks(true)
  }

  watch(
    () => [toValue(scope)?.artistId, toValue(scope)?.albumId],
    () => {
      void reload()
    },
  )

  watch(
    () => [query.value.sort, query.value.order, query.value.starred, query.value.minRating],
    () => {
      persistFilters()
      void reload()
    },
  )

  watch(
    () => query.value.q,
    () => {
      void reload()
    },
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

  onMounted(() => {
    void reload()
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

  const displayTracks = computed(() => tracks.value)
  const trackTotal = computed(() => total.value)
  const trackShown = computed(() => tracks.value.length)

  return {
    query,
    searchInput,
    displayTracks,
    total: trackTotal,
    shown: trackShown,
    hasMore,
    isLoading,
    isLoadMore,
    loadMore,
    sortOptions,
    setSort,
    toggleOrder,
    toggleStarredFilter,
    setMinRating,
    resetFilters,
  }
}
