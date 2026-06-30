import { useRouter } from 'vue-router'
import { t } from '@/i18n/t'
import { useLibraryStore } from '@/stores/library'
import { usePlaybackSyncStore } from '@/stores/playbackSync.js'
import { useAuthStore } from '@/stores/auth'
import { useMetadataEditStore } from '@/stores/metadataEdit'
import { getCoverUrl } from '@/lib/image'
export function useTrackListRowActions(localTracks) {
  const router = useRouter()
  const library = useLibraryStore()
  const playbackSync = usePlaybackSyncStore()
  const auth = useAuthStore()
  const metadataEdit = useMetadataEditStore()

  const getTrackImageUrl = (id) => auth.coverSrc('track', id)

  const prefetchTrackStream = (track) => {
    if (track?.id && auth.token) {
      void auth.prefetchStreamSignatures([String(track.id)])
    }
  }

  const playTrack = (index) => {
    void playbackSync.playTracks(localTracks.value, index)
  }

  const goToArtist = async (artistName) => {
    if (!artistName) return
    const allArtists = await library.getArtists()
    const targetArtist = allArtists.find((a) => a.name === artistName)
    if (targetArtist) router.push({ name: 'artist-detail', params: { id: targetArtist.id } })
  }

  const goToAlbum = (albumId) => {
    if (!albumId) return
    router.push({ name: 'album-detail', params: { id: albumId } })
  }

  const goToTrack = (trackId) => {
    if (!trackId) return
    router.push({ name: 'track-detail', params: { id: trackId } })
  }

  const toggleStar = async (track) => {
    const newStatus = !track.starred
    track.starred = newStatus
    await library.toggleTrackStar(track.id, newStatus)
  }

  const updateRating = async (track, rating) => {
    track.rating = rating
    await library.updateTrackRating(track.id, rating)
  }

  const fetchMetadata = (trackId) => {
    if (!trackId) return
    metadataEdit.fetchPreview('track', trackId)
  }

  const getArtistList = (artistString) => {
    if (!artistString) return [t('common.unknownArtist')]
    return artistString.split(', ')
  }

  const renderStars = (rating) => '★'.repeat(rating || 0) + '☆'.repeat(5 - (rating || 0))

  return {
    getTrackImageUrl,
    prefetchTrackStream,
    playTrack,
    goToArtist,
    goToAlbum,
    goToTrack,
    toggleStar,
    updateRating,
    fetchMetadata,
    getArtistList,
    renderStars
  }
}
