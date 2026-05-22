import { defineStore } from 'pinia'
import { t } from '@/i18n/t'
import { ref, computed } from 'vue'
import { useAuthStore } from './auth'
import { toast } from 'vue-sonner'

/** 트랙/앨범/아티스트 메타데이터 편집·외부 소스 미리보기 큐 */
export const useMetadataEditStore = defineStore('metadataEdit', () => {
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
      const res = await auth.fetchWithAuth(`/api/${type}s/${id}/enrich?mode=preview`, { method: 'POST' })
      const result = await res.json()
      if (res.ok && result.success) {
        reviewQueue.value.push({ type, id, local: result.local, external: result.external })
      }
    } catch (err) {
      console.error('미리보기 로드 실패:', err)
    } finally { isFetching.value = false }
  }

  const applyFromExternal = async (item, customTitle, customArtist) => {
    isFetching.value = true
    try {
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
      const isMultipart = payloadData instanceof FormData
      const headers = {}

      if (!isMultipart) headers['Content-Type'] = 'application/json'

      const res = await auth.fetchWithAuth(`/api/${type}s/${id}`, {
        method: 'PATCH',
        headers,
        body: isMultipart ? payloadData : JSON.stringify(payloadData)
      })

      if (!res.ok) {
        throw new Error(res.status === 413 ? t('metadata.imageTooLarge') : t('metadata.serverError'))
      }

      const result = await res.json()
      if (result.success) {
        return result.data
      }
      throw new Error(result.error || t('metadata.saveErrorGeneric'))
    } catch (err) {
      console.error('🚨 저장 중 오류 발생:', err.message)
      toast.error(t('metadata.saveFailed'))
      return null
    }
  }

  const saveMetadata = async (item, formData) => {
    if (!item?.local?.id) return false
    isFetching.value = true

    try {
      const type = item.type
      const isMultipart = !!formData.newCoverFile
      let payload

      if (isMultipart) {
        payload = new FormData()
        payload.append('title', formData.title || '')
        if (formData.mbid) payload.append('mbid', formData.mbid)
        if (formData.year) payload.append('year', formData.year)
        payload.append('newCoverFile', formData.newCoverFile)
      } else {
        payload = {
          title: formData.title,
          mbid: formData.mbid,
          year: formData.year ? parseInt(formData.year, 10) : null,
          newCoverUrl: formData.newCoverUrl
        }
      }

      if (type === 'track') {
        _attachTrackData(payload, formData, isMultipart)
      } else if (type === 'album') {
        _attachAlbumData(payload, formData, isMultipart)
      } else if (type === 'artist') {
        _attachArtistData(payload, formData, isMultipart)
      }

      return await updateMetadata(type, item.local.id, payload)
    } finally {
      isFetching.value = false
    }
  }

  const _attachTrackData = (payload, formData, isMultipart) => {
    const safeTags = Array.isArray(formData.tags) ? formData.tags : []
    if (isMultipart) {
      payload.append('tags', JSON.stringify(safeTags))
      payload.append('genre', formData.genre || '')
      payload.append('artists', JSON.stringify(formData.artists || []))
      if (formData.albumId) payload.append('albumId', formData.albumId)
      if (formData.albumName) payload.append('albumName', formData.albumName)
    } else {
      payload.tags = safeTags
      payload.genre = formData.genre
      payload.artists = formData.artists || []
      payload.albumId = formData.albumId
      payload.albumName = formData.albumName
    }
  }

  const _attachAlbumData = (payload, formData, isMultipart) => {
    const safeTags = Array.isArray(formData.tags) ? formData.tags : []
    if (isMultipart) {
      payload.append('tags', JSON.stringify(safeTags))
      payload.append('albumArtists', JSON.stringify(formData.albumArtists || []))
      payload.append('albumTracks', JSON.stringify(formData.albumTracks || []))
      payload.append('description', formData.description ?? '')
    } else {
      payload.tags = safeTags
      payload.albumArtists = formData.albumArtists || []
      payload.albumTracks = formData.albumTracks || []
      payload.description = formData.description ?? ''
    }
  }

  const _attachArtistData = (payload, formData, isMultipart) => {
    const safeTags = Array.isArray(formData.tags) ? formData.tags : []
    if (isMultipart) {
      payload.append('tags', JSON.stringify(safeTags))
      if (formData.biography) payload.append('biography', formData.biography)
    } else {
      payload.tags = safeTags
      payload.biography = formData.biography
    }
  }

  return {
    reviewQueue, isFetching, hasItemsInQueue, currentItem,
    fetchPreview, shiftQueue, clearQueue, applyFromExternal, reFetchPreview,
    updateMetadata, saveMetadata
  }
})
