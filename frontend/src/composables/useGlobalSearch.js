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

  const searchLocal = (q) => {
    const needle = q.toLowerCase()
    const artists = (library.artists || [])
      .filter((a) => a.name?.toLowerCase().includes(needle))
      .slice(0, 8)
    const albums = (library.albums || [])
      .filter(
        (a) =>
          a.name?.toLowerCase().includes(needle) ||
          a.displayArtist?.toLowerCase().includes(needle),
      )
      .slice(0, 8)
    return { artists, albums }
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
    const local = searchLocal(q)

    let tracks = []
    try {
      tracks = await library.searchTracks(q, 12)
    } catch {
      tracks = []
    }

    if (id !== reqId) return
    results.value = { artists: local.artists, albums: local.albums, tracks }
    loading.value = false
  }

  watch(query, (value) => {
    if (timer) clearTimeout(timer)
    const q = String(value ?? '').trim()
    if (!q) {
      results.value = { artists: [], albums: [], tracks: [] }
      loading.value = false
      return
    }
    open.value = true
    loading.value = true
    timer = setTimeout(() => {
      void runSearch(q)
    }, 200)
  })

  return {
    query,
    open,
    loading,
    results,
    clear,
    hasAnyResults,
    showPanel,
  }
}
