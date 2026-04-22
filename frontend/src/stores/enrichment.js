import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './auth'

export const useEnrichmentStore = defineStore('enrichment', () => {
  const auth = useAuthStore()
  
  // 상태 관리
  const reviewQueue = ref([])
  const isFetching = ref(false)

  // Getters
  const hasItemsInQueue = computed(() => reviewQueue.value.length > 0)
  const currentItem = computed(() => reviewQueue.value[0] || null)

  // 큐(Queue) 제어
  const shiftQueue = () => reviewQueue.value.shift()
  const clearQueue = () => { reviewQueue.value = [] }

  // ---------------------------------------------------------------------------
  // 💡 데이터 Fetching 메서드
  // ---------------------------------------------------------------------------
  const fetchPreview = async (type, id) => {
    isFetching.value = true
    try {
      const res = await auth.fetchWithAuth(`/api/enrich/${type}/${id}?mode=preview`, { method: 'POST' })
      const result = await res.json()
      if (res.ok && result.success) {
        reviewQueue.value.push({ type, id, local: result.local, external: result.external })
      }
    } catch (err) {
      console.error('미리보기 로드 실패:', err)
    } finally { isFetching.value = false }
  }

  const applyEnrichment = async (item, customTitle, customArtist) => {
    isFetching.value = true
    try {
      const url = `/api/enrich/${item.type}/${item.id}?mode=force&title=${encodeURIComponent(customTitle || '')}&artist=${encodeURIComponent(customArtist || '')}`
      const res = await auth.fetchWithAuth(url, { method: 'POST' })
      const result = await res.json()
      if (res.ok && result.success) shiftQueue()
    } catch (err) {
      console.error('적용 실패:', err)
    } finally { isFetching.value = false }
  }

  const reFetchPreview = async (customTitle, customArtist) => {
    if (!currentItem.value) return
    isFetching.value = true
    try {
      const { type, id } = currentItem.value
      const url = `/api/enrich/${type}/${id}?mode=preview&title=${encodeURIComponent(customTitle)}&artist=${encodeURIComponent(customArtist)}`
      const res = await auth.fetchWithAuth(url, { method: 'POST' })
      const result = await res.json()
      if (res.ok && result.success) currentItem.value.external = result.external
    } catch (err) {
      console.error('재검색 실패:', err)
    } finally { isFetching.value = false }
  }

  // ---------------------------------------------------------------------------
  // 💡 [핵심] API 통신 메서드 (Multipart 통합 지원)
  // ---------------------------------------------------------------------------
  const updateMetadata = async (type, id, payloadData) => {
    try {
      const isMultipart = payloadData instanceof FormData;
      const headers = {};

      if (!isMultipart) headers['Content-Type'] = 'application/json';

      const res = await auth.fetchWithAuth(`/api/enrich/${type}/${id}`, {
        method: 'PATCH',
        headers,
        body: isMultipart ? payloadData : JSON.stringify(payloadData)
      })

      if (!res.ok) {
        throw new Error(res.status === 413 ? "이미지 용량이 너무 큽니다" : "서버 통신 실패")
      }

      const result = await res.json()
      if (result.success) {
        console.log(`✅ [${type}] 저장 완료`) 
        // 💡 1. 여기서 호출하던 shiftQueue()를 제거합니다 (다이얼로그가 책임지도록).
        // 💡 2. true 대신, 백엔드에서 받은 따끈따끈한 최신 데이터를 반환합니다!
        return result.data 
      }
      throw new Error(result.error || '저장 실패')
    } catch (err) {
      console.error('🚨 저장 중 오류 발생:', err.message)
      alert(err.message) 
      return null // false 대신 null 반환
    }
  }

  // ---------------------------------------------------------------------------
  // 💡 [모듈화] 데이터 조립 및 저장 (Facade 패턴)
  // ---------------------------------------------------------------------------
  const saveEnrichmentData = async (item, formData) => {
    if (!item?.local?.id) return false;
    isFetching.value = true;
    
    try {
      const type = item.type;
      const isMultipart = !!formData.newCoverFile;
      let payload;

      // 1. 공통 데이터 바인딩
      if (isMultipart) {
        payload = new FormData();
        payload.append('title', formData.title || '');
        if (formData.mbid) payload.append('mbid', formData.mbid);
        if (formData.year) payload.append('year', formData.year);
        payload.append('newCoverFile', formData.newCoverFile);
      } else {
        payload = {
          title: formData.title,
          mbid: formData.mbid,
          year: formData.year ? parseInt(formData.year, 10) : null,
          newCoverUrl: formData.newCoverUrl
        };
      }

      // 2. 타입별 특수 데이터 바인딩 (선생님 제안대로 내부 로직 분리!)
      if (type === 'track') {
        _attachTrackData(payload, formData, isMultipart);
      } else if (type === 'album') {
        _attachAlbumData(payload, formData, isMultipart);
      } else if (type === 'artist') {
        _attachArtistData(payload, formData, isMultipart);
      }

      // 3. API 호출
      return await updateMetadata(type, item.local.id, payload);
    } finally {
      isFetching.value = false;
    }
  }

  // 내부 헬퍼 함수들 (은닉화)
  const _attachTrackData = (payload, formData, isMultipart) => {
    if (isMultipart) {
      payload.append('tags', JSON.stringify(formData.tags || []));
      if (formData.genre) payload.append('genre', formData.genre);
      payload.append('artists', JSON.stringify(formData.artists || []));
      if (formData.albumId) payload.append('albumId', formData.albumId);
      if (formData.albumName) payload.append('albumName', formData.albumName);
    } else {
      payload.tags = formData.tags || [];
      payload.genre = formData.genre;
      payload.artists = formData.artists || [];
      payload.albumId = formData.albumId;
      payload.albumName = formData.albumName;
    }
  }

  const _attachAlbumData = (payload, formData, isMultipart) => {
    if (isMultipart) {
      // 💉 v2.1 스키마: mainArtist 버리고 albumArtists 배열 사용
      payload.append('albumArtists', JSON.stringify(formData.albumArtists || []));
      payload.append('albumTracks', JSON.stringify(formData.albumTracks || []));
    } else {
      payload.albumArtists = formData.albumArtists || [];
      payload.albumTracks = formData.albumTracks || [];
    }
  }

  const _attachArtistData = (payload, formData, isMultipart) => {
    if (isMultipart) {
      payload.append('tags', JSON.stringify(formData.tags || []));
      if (formData.biography) payload.append('biography', formData.biography);
    } else {
      payload.tags = formData.tags || [];
      payload.biography = formData.biography;
    }
  }

  return {
    reviewQueue, isFetching, hasItemsInQueue, currentItem,
    fetchPreview, shiftQueue, clearQueue, applyEnrichment, reFetchPreview,
    updateMetadata, saveEnrichmentData // 💉 공개 API
  }
})