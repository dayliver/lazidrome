import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './auth'
import { toast } from 'vue-sonner'
import { t } from '@/i18n/t'

export const usePlaylistStore = defineStore('playlist', () => {
  const auth = useAuthStore()
  
  const playlists = ref([])
  const currentPlaylist = ref(null)
  const isFetching = ref(false)

  // 💡 뷰(UI)에서 메뉴를 나눠 그리기 편하도록 Getters 제공
  const manualPlaylists = computed(() => playlists.value.filter(p => p.type === 'list'))
  const smartMixes = computed(() => playlists.value.filter(p => p.type === 'mix'))

  // 1. 전체 목록 불러오기 (사이드바용)
  const fetchPlaylists = async () => {
    isFetching.value = true
    try {
      const res = await auth.fetchWithAuth('/api/playlists')
      if (res.ok) playlists.value = await res.json()
    } catch (err) {
      console.error('플레이리스트 목록 로드 실패:', err)
    } finally {
      isFetching.value = false
    }
  }

  // 💡 [헬퍼 함수] FormData vs JSON 페이로드 자동 생성기
  const buildPayload = (data) => {
    if (data.newCoverFile) {
      const formData = new FormData()
      formData.append('name', data.name)
      formData.append('description', data.description || '')
      formData.append('type', data.type)
      
      if (data.type === 'mix') {
        formData.append('rules', JSON.stringify(data.rules))
      } else if (data.type === 'list' && data.playlistTracks) {
        // 💡 FormData에는 배열을 JSON 문자열로 변환해서 넣습니다.
        formData.append('playlistTracks', JSON.stringify(data.playlistTracks))
      }
      
      formData.append('newCoverFile', data.newCoverFile)
      return { body: formData, headers: {} }
    } else {
      return {
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          type: data.type,
          rules: data.type === 'mix' ? data.rules : null,
          // 💡 JSON 페이로드에 트랙 배열 추가
          playlistTracks: data.type === 'list' ? data.playlistTracks : [] 
        }),
        headers: { 'Content-Type': 'application/json' }
      }
    }
  }

  // =====================================================================
  // 새 플레이리스트 / 스마트 믹스 생성
  // =====================================================================
  const createPlaylist = async (playlistData) => {
    try {
      const { body, headers } = buildPayload(playlistData)
      const res = await auth.fetchWithAuth('/api/playlists', {
        method: 'POST',
        headers,
        body
      })
      const result = await res.json()
      if (result.success) {
        playlists.value.unshift(result.data)
        return result.data
      }
      return null
    } catch (err) {
      console.error('플레이리스트 생성 실패:', err)
      return null
    }
  }

  // =====================================================================
  // 플레이리스트 / 믹스 정보 수정
  // =====================================================================
  const updatePlaylist = async (id, payloadData) => {
    try {
      const { body, headers } = buildPayload(payloadData)
      const res = await auth.fetchWithAuth(`/api/playlists/${id}`, {
        method: 'PUT',
        headers,
        body
      })
      const result = await res.json()
      if (result.success) {
        const index = playlists.value.findIndex(p => p.id === id)
        if (index !== -1) {
          playlists.value[index] = { ...playlists.value[index], ...result.data }
        }
        if (currentPlaylist.value?.id === id) {
          currentPlaylist.value = { ...currentPlaylist.value, ...result.data }
        }
        return result.data
      }
      return null
    } catch (err) {
      console.error('플레이리스트 수정 실패:', err)
      return null
    }
  }

  // 3. 상세 조회 (곡 목록 포함 - 클릭 시 호출)
  const fetchPlaylistDetails = async (id) => {
    isFetching.value = true
    try {
      const res = await auth.fetchWithAuth(`/api/playlists/${id}`)
      if (res.ok) {
        currentPlaylist.value = await res.json()
        return currentPlaylist.value
      }
      return null
    } catch (err) {
      console.error('상세 조회 실패:', err)
      return null
    } finally {
      isFetching.value = false
    }
  }

  // 4. [수동] 곡 추가 (여러 곡 한 번에 추가 가능)
  const addTracksToPlaylist = async (playlistId, trackIds) => {
    try {
      const res = await auth.fetchWithAuth(`/api/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackIds })
      })
      const result = await res.json()
      if (result.success) {
        
        // 💡 alert 대신 아리따운 sonner 토스트 적용!
        toast.success(t('playlist.addedSuccess'), {
          description: t('playlist.addedSuccessDesc', { count: trackIds.length }),
        })

        if (currentPlaylist.value?.id === playlistId) {
          await fetchPlaylistDetails(playlistId)
        }
        return true
      }
      return false
    } catch (err) {
      console.error('곡 추가 실패:', err)
      toast.error(t('playlist.addFailed'))
      return false
    }
  }

  // 5. [수동] 곡 순서 변경 (Drag & Drop 완료 시 호출)
  const reorderTracks = async (playlistId, items) => {
    // items: [{ playlistTrackId: 'ulid...', position: 10 }, ...]
    try {
      const res = await auth.fetchWithAuth(`/api/playlists/${playlistId}/tracks/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      })
      return (await res.json()).success
    } catch (err) {
      console.error('순서 변경 실패:', err)
      return false
    }
  }

  // 6. [수동] 특정 곡 삭제
  const removeTrack = async (playlistId, playlistTrackId) => {
    try {
      const res = await auth.fetchWithAuth(`/api/playlists/${playlistId}/tracks/${playlistTrackId}`, {
        method: 'DELETE'
      })
      if ((await res.json()).success) {
        // UI 즉시 반영 (Local Mutation)
        if (currentPlaylist.value?.id === playlistId) {
          currentPlaylist.value.tracks = currentPlaylist.value.tracks.filter(
            t => t.playlist_track_id !== playlistTrackId
          )
        }
        return true
      }
      return false
    } catch (err) {
      console.error('곡 삭제 실패:', err)
      return false
    }
  }

  // 7. 플레이리스트 자체 삭제
  const deletePlaylist = async (id) => {
    try {
      const res = await auth.fetchWithAuth(`/api/playlists/${id}`, { method: 'DELETE' })
      if ((await res.json()).success) {
        playlists.value = playlists.value.filter(p => p.id !== id)
        if (currentPlaylist.value?.id === id) currentPlaylist.value = null
        return true
      }
      return false
    } catch (err) {
      console.error('플레이리스트 삭제 실패:', err)
      return false
    }
  }

  return {
    playlists, currentPlaylist, isFetching,
    manualPlaylists, smartMixes,
    fetchPlaylists, createPlaylist, updatePlaylist, fetchPlaylistDetails,
    addTracksToPlaylist, reorderTracks, removeTrack, deletePlaylist
  }
})