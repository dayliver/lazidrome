import { useRouter } from 'vue-router'
import { useLibraryStore } from '@/stores/library'
import { usePlayerStore } from '@/stores/player'
import { useAuthStore } from '@/stores/auth'
import { useMetadataEditStore } from '@/stores/metadataEdit'
import { getCoverUrl } from '@/lib/image'
export function useTrackListRowActions(localTracks) {
  const router = useRouter()
  const library = useLibraryStore()
  const player = usePlayerStore()
  const auth = useAuthStore()
  const metadataEdit = useMetadataEditStore()

  const getTrackImageUrl = (id) => auth.coverSrc('track', id)

  const prefetchTrackStream = (track) => {
    if (track?.id && auth.token) {
      void auth.prefetchStreamSignatures([String(track.id)])
    }
  }

  const playTrack = (index) => {
    if (player.playList) player.playList(localTracks.value, index)
    else player.playNewQueue(localTracks.value, index)
  }

  const goToArtist = async (artistName) => {
    if (!artistName || artistName === 'Unknown Artist') return
    const allArtists = await library.getArtists()
    const targetArtist = allArtists.find((a) => a.name === artistName)
    if (targetArtist) router.push({ name: 'artist-detail', params: { id: targetArtist.id } })
  }

  const goToAlbum = (albumId) => {
    if (!albumId) return
    router.push({ name: 'album-detail', params: { id: albumId } })
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
    if (!artistString) return ['Unknown Artist']
    return artistString.split(', ')
  }

  const renderStars = (rating) => '★'.repeat(rating || 0) + '☆'.repeat(5 - (rating || 0))

  return {
    getTrackImageUrl,
    prefetchTrackStream,
    playTrack,
    goToArtist,
    goToAlbum,
    toggleStar,
    updateRating,
    fetchMetadata,
    getArtistList,
    renderStars
  }
}
