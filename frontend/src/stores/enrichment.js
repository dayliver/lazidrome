import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from './auth'

export const useEnrichmentStore = defineStore('enrichment', () => {
  const auth = useAuthStore()
  
  const reviewQueue = ref([])
  const isFetching = ref(false)

  const hasItemsInQueue = computed(() => reviewQueue.value.length > 0)
  const currentItem = computed(() => reviewQueue.value[0] || null)

  const shiftQueue = () => reviewQueue.value.shift()
  const clearQueue = () => { reviewQueue.value = [] }

  const fetchPreview = async (type, id) => {
    isFetching.value = true
    try {
      // 💡 주소 변경: /api/albums/123/enrich 형태로 전송
      const res = await auth.fetchWithAuth(`/api/${type}s/${id}/enrich?mode=preview`, { method: 'POST' })
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
      // 💡 주소 변경
      const url = `/api/${item.type}s/${item.id}/enrich?mode=force&title=${encodeURIComponent(customTitle || '')}&artist=${encodeURIComponent(customArtist || '')}`
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
      // 💡 주소 변경
      const url = `/api/${type}s/${id}/enrich?mode=preview&title=${encodeURIComponent(customTitle)}&artist=${encodeURIComponent(customArtist)}`
      const res = await auth.fetchWithAuth(url, { method: 'POST' })
      const result = await res.json()
      if (res.ok && result.success) currentItem.value.external = result.external
    } catch (err) {
      console.error('재검색 실패:', err)
    } finally { isFetching.value = false }
  }

  const updateMetadata = async (type, id, payloadData) => {
    try {
      const isMultipart = payloadData instanceof FormData;
      const headers = {};

      if (!isMultipart) headers['Content-Type'] = 'application/json';

      // 💡 주소 변경: PATCH /api/albums/123 형태로 전송
      const res = await auth.fetchWithAuth(`/api/${type}s/${id}`, {
        method: 'PATCH',
        headers,
        body: isMultipart ? payloadData : JSON.stringify(payloadData)
      })

      if (!res.ok) {
        throw new Error(res.status === 413 ? "이미지 용량이 너무 큽니다" : "서버 통신 실패")
      }

      const result = await res.json()
      if (result.success) {
        return result.data 
      }
      throw new Error(result.error || '저장 실패')
    } catch (err) {
      console.error('🚨 저장 중 오류 발생:', err.message)
      alert(err.message) 
      return null
    }
  }

  const saveEnrichmentData = async (item, formData) => {
    if (!item?.local?.id) return false;
    isFetching.value = true;
    
    try {
      const type = item.type;
      const isMultipart = !!formData.newCoverFile;
      let payload;

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

      if (type === 'track') {
        _attachTrackData(payload, formData, isMultipart);
      } else if (type === 'album') {
        _attachAlbumData(payload, formData, isMultipart);
      } else if (type === 'artist') {
        _attachArtistData(payload, formData, isMultipart);
      }

      return await updateMetadata(type, item.local.id, payload);
    } finally {
      isFetching.value = false;
    }
  }

  // 💡 [버그 완치] 태그(배열) 직렬화 및 빈 배열 방어 로직
  const _attachTrackData = (payload, formData, isMultipart) => {
    const safeTags = Array.isArray(formData.tags) ? formData.tags : [];
    if (isMultipart) {
      payload.append('tags', JSON.stringify(safeTags));
      payload.append('genre', formData.genre || '');
      payload.append('artists', JSON.stringify(formData.artists || []));
      if (formData.albumId) payload.append('albumId', formData.albumId);
      if (formData.albumName) payload.append('albumName', formData.albumName);
    } else {
      payload.tags = safeTags;
      payload.genre = formData.genre;
      payload.artists = formData.artists || [];
      payload.albumId = formData.albumId;
      payload.albumName = formData.albumName;
    }
  }

  const _attachAlbumData = (payload, formData, isMultipart) => {
    const safeTags = Array.isArray(formData.tags) ? formData.tags : [];
    if (isMultipart) {
      payload.append('tags', JSON.stringify(safeTags));
      payload.append('albumArtists', JSON.stringify(formData.albumArtists || []));
      payload.append('albumTracks', JSON.stringify(formData.albumTracks || []));
    } else {
      payload.tags = safeTags;
      payload.albumArtists = formData.albumArtists || [];
      payload.albumTracks = formData.albumTracks || [];
    }
  }

  const _attachArtistData = (payload, formData, isMultipart) => {
    const safeTags = Array.isArray(formData.tags) ? formData.tags : [];
    if (isMultipart) {
      payload.append('tags', JSON.stringify(safeTags));
      if (formData.biography) payload.append('biography', formData.biography);
    } else {
      payload.tags = safeTags;
      payload.biography = formData.biography;
    }
  }

  return {
    reviewQueue, isFetching, hasItemsInQueue, currentItem,
    fetchPreview, shiftQueue, clearQueue, applyEnrichment, reFetchPreview,
    updateMetadata, saveEnrichmentData
  }
})