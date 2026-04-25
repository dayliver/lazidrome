import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './auth'

export const useLibraryStore = defineStore('library', () => {
  const auth = useAuthStore()
  
  const tracks = ref([])
  const artists = ref([])
  const albums = ref([])
  
  const isSyncing = ref(false)
  const syncStatusText = ref('대기 중')
  
  // 💉 수술: 현재 진행 중인 API 요청을 담아둘 변수
  let fetchPromise = null 

  const trackCount = computed(() => tracks.value.length)

  const fetchLibrary = async () => {
    // 💉 핵심: 이미 누군가 요청을 보냈다면, 그 요청(Promise)을 똑같이 던져주어 같이 기다리게 합니다.
    if (fetchPromise) return fetchPromise 

    fetchPromise = (async () => {
      isSyncing.value = true
      syncStatusText.value = 'Lazidrome 엔진에서 데이터 수신 중...'

      try {
        // 💉 속도 최적화: 3개의 라우트를 동시에 찔러서 병렬로 가져옵니다.
        const [trackRes, artistRes, albumRes] = await Promise.all([
          auth.fetchWithAuth('/api/tracks'),
          auth.fetchWithAuth('/api/artists'),
          auth.fetchWithAuth('/api/albums')
        ])

        // 💡 꼼수 파싱 로직 전면 폐기! 백엔드가 주는 완성품을 그대로 꽂아넣습니다.
        tracks.value = await trackRes.json()
        artists.value = await artistRes.json()
        albums.value = await albumRes.json()

        syncStatusText.value = '동기화 완료'
      } catch (error) {
        console.error('❌ 데이터 로드 실패:', error)
        syncStatusText.value = '에러 발생'
      } finally {
        isSyncing.value = false
        fetchPromise = null // 💉 완료되면 Promise를 비워주어 다음 새로고침 시 다시 요청할 수 있게 합니다.
      }
    })()

    return fetchPromise
  }

  const getTracks = async () => {
    if (tracks.value.length === 0) await fetchLibrary()
    return tracks.value
  }

  const getArtists = async () => {
    if (artists.value.length === 0) await fetchLibrary()
    return artists.value
  }

  const getAlbums = async () => {
    if (albums.value.length === 0) await fetchLibrary()
    return albums.value
  }

  const updateTrackRating = async (trackId, rating) => {
    try {
      // 💡 주소 끝에 /rating을 명시적으로 붙여줍니다!
      const res = await auth.fetchWithAuth(`/api/tracks/${trackId}/rating`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating })
      })

      if (res.ok) {
        const track = tracks.value.find(t => t.id === trackId)
        if (track) track.rating = rating
      }
    } catch (err) {
      console.error('별점 서버 전송 실패:', err)
    }
  }

  const toggleTrackStar = async (trackId, starred) => {
    try {
      // 💡 별점과 하트 모두 퀵 업데이트이므로 같은 라우트를 재사용합니다.
      const res = await auth.fetchWithAuth(`/api/tracks/${trackId}/rating`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starred: starred ? 1 : 0 }) // SQLite를 위해 1/0으로 변환
      })

      if (res.ok) {
        const track = tracks.value.find(t => t.id === trackId)
        if (track) track.starred = starred
      }
    } catch (err) {
      console.error('좋아요 서버 전송 실패:', err)
    }
  }

  // 💉 수술: 상세 페이지용 단일 객체 패치 함수 추가
  const getArtistById = async (id) => {
    try {
      const res = await auth.fetchWithAuth(`/api/artists/${id}`)
      if (!res.ok) throw new Error('Artist not found')
      return await res.json()
    } catch (error) {
      console.error(`❌ 아티스트 정보 로드 실패 (${id}):`, error)
      return null
    }
  }

  const getAlbumById = async (id) => {
    try {
      const res = await auth.fetchWithAuth(`/api/albums/${id}`)
      if (!res.ok) throw new Error('Album not found')
      return await res.json()
    } catch (error) {
      console.error(`❌ 앨범 정보 로드 실패 (${id}):`, error)
      return null
    }
  }

  // =====================================================================
  // 💡 [2단계 신규 추가] 국소적 변이 (Local Mutation) 함수들
  // =====================================================================
  
  const updateLocalArtist = (newData) => {
    const index = artists.value.findIndex(a => a.id === newData.id)
    if (index !== -1) {
      const parsedTags = typeof newData.tags === 'string' 
        ? (newData.tags ? JSON.parse(newData.tags).slice(0, 3) : []) 
        : (newData.tags || []);
      
      // 💡 새 객체 생성 대신 기존 객체에 덮어씌우기 (Object.assign)
      Object.assign(artists.value[index], {
        ...newData,
        topTags: parsedTags
      });
    }
  }

  const updateLocalAlbum = (newData) => {
    const index = albums.value.findIndex(a => a.id === newData.id)
    if (index !== -1) {
      Object.assign(albums.value[index], newData);
    }
  }

  const updateLocalTrack = (newData) => {
    const index = tracks.value.findIndex(t => t.id === newData.id)
    if (index !== -1) {
      const processedData = { ...newData }
      // 태그 파싱 방어 로직 추가
      if (typeof newData.tags === 'string') {
        try { processedData.tags = JSON.parse(newData.tags) }
        catch (e) { processedData.tags = [] }
      }
      
      // 💡 핵심: 기존 객체의 메모리 주소를 유지한 채 내용물만 업데이트!
      Object.assign(tracks.value[index], processedData);
    }
  }

  return {
    tracks,
    artists,
    albums,
    trackCount,
    isSyncing,
    syncStatusText,
    fetchLibrary,
    getArtists,
    getAlbums,
    getTracks,
    updateTrackRating,
    toggleTrackStar,
    getArtistById,
    getAlbumById,
    updateLocalArtist,
    updateLocalAlbum,
    updateLocalTrack
  }
})