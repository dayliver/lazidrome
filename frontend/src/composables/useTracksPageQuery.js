import { ref, watch, onMounted, computed } from 'vue'
import { useLibraryStore } from '@/stores/library'
import { useRequiresAuth } from '@/composables/useRequiresAuth'
import {
  DEFAULT_TRACK_LIST_QUERY,
  loadPersistedTrackListQuery,
  persistTrackListQuery,
  sortsToParam,
  storageKeyForTrackListPreset,
} from '@/lib/trackListQuery'

const SEARCH_DEBOUNCE_MS = 320

export function useTracksPageQuery({ limit = 50 } = {}) {
  const library = useLibraryStore()
  const { showAuthEmpty } = useRequiresAuth()

  const persisted = loadPersistedTrackListQuery(storageKeyForTrackListPreset('tracksPage'))
  const query = ref({
    ...DEFAULT_TRACK_LIST_QUERY,
    sorts: persisted?.sorts ?? [],
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

  const persistFilters = () => {
    persistTrackListQuery(query.value, storageKeyForTrackListPreset('tracksPage'))
  }

  const loadTracks = async (append = false) => {
    if (showAuthEmpty.value) {
      tracks.value = []
      total.value = 0
      hasMore.value = false
      isLoading.value = false
      return
    }

    const generation = ++loadGeneration

    if (!append) isLoading.value = true
    else isLoadMore.value = true

    try {
      if (!library.trackCount && !library.isSyncing) {
        await library.fetchServerSettings().catch(() => library.fetchLibrary())
      }

      const page = await library.fetchTracksPage({
        offset: offset.value,
        limit,
        sorts: sortsToParam(query.value.sorts),
        q: query.value.q,
        starred: query.value.starred,
        minRating: query.value.minRating,
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
    () => [query.value.sorts, query.value.starred, query.value.minRating],
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

  watch(showAuthEmpty, () => {
    void reload()
  })

  onMounted(() => {
    void reload()
  })

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

  const toggleSortColumn = (key) => {
    const stack = [...query.value.sorts]
    const idx = stack.findIndex((s) => s.key === key)
    if (idx === -1) {
      stack.push({ key, order: 'asc' })
    } else if (stack[idx].order === 'asc') {
      stack[idx] = { key, order: 'desc' }
    } else {
      stack.splice(idx, 1)
    }
    query.value = { ...query.value, sorts: stack }
  }

  const sortState = (key) => {
    const entry = query.value.sorts.find((s) => s.key === key)
    return entry?.order ?? null
  }

  const sortPriority = (key) => {
    const idx = query.value.sorts.findIndex((s) => s.key === key)
    return idx >= 0 ? idx + 1 : null
  }

  const activeSortCount = computed(() => query.value.sorts.length)

  return {
    query,
    searchInput,
    tracks,
    total,
    hasMore,
    isLoading,
    isLoadMore,
    loadMore,
    toggleStarredFilter,
    setMinRating,
    toggleSortColumn,
    sortState,
    sortPriority,
    activeSortCount,
  }
}
