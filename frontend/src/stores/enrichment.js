import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './auth'

export const useEnrichmentStore = defineStore('enrichment', () => {
  const auth = useAuthStore()
  
  // 📦 검토 대기열 (큐)
  const reviewQueue = ref([])
  
  // 현재 API 통신 중인지 여부
  const isFetching = ref(false)

  // 큐에 항목이 있는지 확인하는 computed 속성
  const hasItemsInQueue = computed(() => reviewQueue.value.length > 0)
  
  // 현재 검토 중인 첫 번째 항목
  const currentItem = computed(() => reviewQueue.value[0] || null)

  /**
   * 1. 큐에 추가하기 (미리보기 데이터 요청)
   * TracksView 등에서 "메타데이터 가져오기"를 누르면 실행됩니다.
   */
  const fetchPreview = async (type, id) => {
    isFetching.value = true
    try {
      const res = await auth.fetchWithAuth(`/api/enrich/${type}/${id}?mode=preview`, {
        method: 'POST'
      })
      
      const result = await res.json()
      
      if (res.ok && result.success) {
        // 성공적으로 데이터를 가져오면 큐의 맨 뒤에 밀어 넣습니다.
        reviewQueue.value.push({
          type,        // 'track', 'album', 'artist'
          id,          // 해당 항목의 ID
          local: result.local,       // 내 로컬 DB 정보
          external: result.external  // Last.fm에서 긁어온 정보
        })
      } else {
        console.warn('Last.fm 데이터를 찾지 못했습니다:', result.error)
        // TODO: 사용자에게 "데이터가 없습니다" 토스트 알림 띄우기
      }
    } catch (err) {
      console.error('메타데이터 미리보기 요청 중 오류:', err)
    } finally {
      isFetching.value = false
    }
  }

  /**
   * 2. 큐에서 현재 항목 제거 (Next / Skip 버튼 역할)
   */
  const shiftQueue = () => {
    reviewQueue.value.shift()
  }

  /**
   * 3. 큐 비우기 (일괄 취소)
   */
  const clearQueue = () => {
    reviewQueue.value = []
  }

  /**
   * 4. 데이터 덮어쓰기 (백엔드에 반영 요청)
   */
  // 💉 파라미터에 customTitle, customArtist 추가
  const applyEnrichment = async (item, customTitle, customArtist) => {
    isFetching.value = true
    try {
      // 💉 URL에 수동 검색어 파라미터를 포함하여 백엔드가 엉뚱한 검색을 하지 않도록 방어합니다.
      const url = `/api/enrich/${item.type}/${item.id}?mode=force&title=${encodeURIComponent(customTitle || '')}&artist=${encodeURIComponent(customArtist || '')}`
      
      const res = await auth.fetchWithAuth(url, {
        method: 'POST'
      })
      
      const result = await res.json()
      
      if (res.ok && result.success) {
        console.log(`✅ [${item.type}] 메타데이터 업데이트 완료!`)
        shiftQueue()
      } else {
        throw new Error(result.error || '업데이트 실패')
      }
    } catch (err) {
      console.error('적용 중 오류 발생:', err)
      alert('데이터를 적용하는 중 오류가 발생했습니다.')
    } finally {
      isFetching.value = false
    }
  }

  /**
   * 💡 수동 검색 (재요청)
   * 사용자가 모달에서 직접 제목/아티스트를 수정하여 다시 검색할 때 사용합니다.
   */
  const reFetchPreview = async (customTitle, customArtist) => {
    if (!currentItem.value) return
    isFetching.value = true
    try {
      const { type, id } = currentItem.value
      // URL에 수동 검색어(title, artist)를 붙여서 보냅니다.
      const url = `/api/enrich/${type}/${id}?mode=preview&title=${encodeURIComponent(customTitle)}&artist=${encodeURIComponent(customArtist)}`
      
      const res = await auth.fetchWithAuth(url, { method: 'POST' })
      const result = await res.json()
      
      if (res.ok && result.success) {
        // 오른쪽 Last.fm 제안 데이터만 새로운 결과로 샥! 갈아끼웁니다.
        currentItem.value.external = result.external
      } else {
        alert('해당 검색어로 Last.fm에서 데이터를 찾을 수 없습니다.')
      }
    } catch (err) {
      console.error('수동 검색 중 오류:', err)
    } finally {
      isFetching.value = false
    }
  }

  return {
    reviewQueue,
    isFetching,
    hasItemsInQueue,
    currentItem,
    fetchPreview,
    shiftQueue,
    clearQueue,
    applyEnrichment,
    reFetchPreview
  }
})