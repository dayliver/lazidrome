import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useLibraryStore } from '@/stores/library'
import { useAuthStore } from '@/stores/auth'
import { usePlaybackSyncStore } from '@/stores/playbackSync.js'
import { usePreferencesStore } from '@/stores/preferences'
import { ensureLegacyVisitsDiscarded } from '@/lib/visitHistory'
import { useHorizontalDragScroll } from '@/composables/useHorizontalDragScroll'
import { useHomeTopStripAutoScroll } from '@/composables/useHomeTopStripAutoScroll'
import { t } from '@/i18n/t'

function kindLabel(type) {
  const key = `visit.${type}`
  const msg = t(key)
  return msg !== key ? msg : type
}

export function useHomePage() {
  const library = useLibraryStore()
  const auth = useAuthStore()
  const playbackSync = usePlaybackSyncStore()
  const prefs = usePreferencesStore()
  const route = useRoute()

  const visits = ref([])
  const top20 = ref([])
  const topArtists = ref([])
  const topLoading = ref(false)
  const topError = ref(null)

  const applyDashboard = (data) => {
    visits.value = Array.isArray(data?.frequentVisits) ? data.frequentVisits : []
    top20.value = Array.isArray(data?.topTracks) ? data.topTracks : []
    topArtists.value = Array.isArray(data?.topArtists) ? data.topArtists : []
  }

  const loadDashboard = async ({ visitsOnly = false } = {}) => {
    if (!auth.isAuthenticated) {
      visits.value = []
      if (!visitsOnly) {
        top20.value = []
        topArtists.value = []
      }
      return
    }
    if (!visitsOnly) {
      topLoading.value = true
      topError.value = null
    }
    try {
      const data = await library.fetchHomeDashboard({
        limit: 20,
        visitLimit: 24,
        timezone: prefs.effectiveTimezone,
      })
      if (visitsOnly) {
        visits.value = Array.isArray(data?.frequentVisits) ? data.frequentVisits : []
      } else {
        applyDashboard(data)
      }
    } catch (e) {
      console.error(e)
      if (visitsOnly) {
        visits.value = []
      } else {
        topError.value = e
        visits.value = []
        top20.value = []
        topArtists.value = []
      }
    } finally {
      if (!visitsOnly) topLoading.value = false
    }
  }

  const refreshVisits = async () => {
    await loadDashboard({ visitsOnly: true })
  }

  function visitTo(v) {
    switch (v.type) {
      case 'playlist':
        return { name: 'playlist-detail', params: { id: v.id } }
      case 'album':
        return { name: 'album-detail', params: { id: v.id } }
      case 'artist':
        return { name: 'artist-detail', params: { id: v.id } }
      case 'tag':
        return { name: 'tag-detail', params: { name: v.id } }
      case 'track':
        return { name: 'track-detail', params: { id: v.id } }
      default:
        return null
    }
  }

  function resolveVisitName(v) {
    if (v.name && String(v.name).trim()) return String(v.name).trim()
    if (v.type === 'track') {
      const tr = library.tracks.find((x) => String(x.id) === String(v.id))
      return tr?.title || ''
    }
    if (v.type === 'tag') return v.id
    return ''
  }

  function visitCoverSrc(v) {
    if (!auth.token) return ''
    if (v.type === 'album') return auth.coverSrc('album', v.id)
    if (v.type === 'artist') return auth.coverSrc('artist', v.id)
    if (v.type === 'playlist') return auth.coverSrc('playlist', v.id)
    if (v.type === 'track') return auth.coverSrc('track', v.id)
    return ''
  }

  function visitImageType(v) {
    if (v.type === 'artist') return 'artist'
    if (v.type === 'album' || v.type === 'playlist') return 'album'
    if (v.type === 'track') return 'track'
    return 'track'
  }

  const visitItems = computed(() =>
    visits.value
      .map((v) => {
        const displayName = resolveVisitName(v)
        return {
          ...v,
          kindLabel: kindLabel(v.type),
          displayName,
          to: visitTo(v),
          coverSrc: visitCoverSrc(v),
          imageType: visitImageType(v),
        }
      })
      .filter((v) => v.type === 'tag' || (v.displayName && String(v.displayName).trim())),
  )

  const loadTop20 = async () => {
    await loadDashboard()
  }

  const loadHome = async () => {
    if (!auth.isAuthenticated) return
    await ensureLegacyVisitsDiscarded()
    await loadDashboard()
  }

  onMounted(() => {
    void loadHome()
  })

  watch(
    () => route.name,
    (n) => {
      if (n === 'home') void refreshVisits()
    },
  )

  watch(
    () => auth.token,
    (tok) => {
      if (tok) void loadHome()
      else {
        visits.value = []
        top20.value = []
        topArtists.value = []
      }
    },
  )

  watch(
    () => prefs.effectiveTimezone,
    () => {
      if (auth.isAuthenticated) void loadTop20()
    },
  )

  const playTopFromIndex = (indexInTop20) => {
    if (!top20.value.length || indexInTop20 < 0 || indexInTop20 >= top20.value.length) return
    void playbackSync.playTracks(top20.value, indexInTop20)
  }

  const { elRef: visitStripRef, stripHandlers: visitStripDrag } = useHorizontalDragScroll()
  const { elRef: topStripRef, stripHandlers: topStripDrag } = useHorizontalDragScroll()
  const { elRef: topArtistsStripRef, stripHandlers: topArtistsStripDrag } = useHorizontalDragScroll()

  const { topStripBind, onStripMouseEnter, onStripMouseLeave } = useHomeTopStripAutoScroll({
    topStripRef,
    topStripDrag,
    itemCount: () => top20.value.length,
  })

  return {
    auth,
    visitItems,
    top20,
    topArtists,
    topLoading,
    topError,
    visitStripRef,
    visitStripBind: { ...visitStripDrag },
    topStripRef,
    topStripBind,
    topArtistsStripRef,
    topArtistsStripBind: { ...topArtistsStripDrag },
    onStripMouseEnter,
    onStripMouseLeave,
    playTopFromIndex,
  }
}
