import { ref, watch, computed } from 'vue'
import { useLibraryStore } from '@/stores/library'
import { useAuthStore } from '@/stores/auth'

const query = ref('')
const open = ref(false)
const loading = ref(false)
const results = ref({ artists: [], albums: [], tracks: [] })

let timer = null
let reqId = 0

export function useGlobalSearch() {
  const library = useLibraryStore()
  const auth = useAuthStore()

  const hasAnyResults = computed(() => {
    const r = results.value
    return r.artists.length + r.albums.length + r.tracks.length > 0
  })

  const showPanel = computed(
    () => open.value && String(query.value ?? '').trim().length > 0,
  )

  const clear = () => {
    query.value = ''
    open.value = false
    results.value = { artists: [], albums: [], tracks: [] }
  }

  const runSearch = async (raw) => {
    const q = String(raw ?? '').trim()
    if (!q || !auth.isAuthenticated) {
      results.value = { artists: [], albums: [], tracks: [] }
      loading.value = false
      return
    }

    const id = ++reqId
    loading.value = true

    let artists = []
    let albums = []
    let tracks = []

    try {
      ;[artists, albums, tracks] = await Promise.all([
        library.searchArtists(q, 8),
        library.searchAlbums(q, 8),
        library.searchTracks(q, 10),
      ])
    } catch (err) {
      console.error(err)
    }

    if (id !== reqId) return
    results.value = { artists, albums, tracks }
    loading.value = false
  }

  watch(query, (value) => {
    if (timer) clearTimeout(timer)
    const trimmed = String(value ?? '').trim()
    if (!trimmed) {
      results.value = { artists: [], albums: [], tracks: [] }
      loading.value = false
      return
    }
    timer = setTimeout(() => {
      void runSearch(trimmed)
    }, 280)
  })

  return {
    query,
    open,
    loading,
    results,
    hasAnyResults,
    showPanel,
    clear,
    runSearch,
  }
}
