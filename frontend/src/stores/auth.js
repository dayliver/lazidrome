import { defineStore } from 'pinia'
import { ref, computed, reactive, watch } from 'vue'
import { getCoverUrl } from '@/lib/image'
import { t } from '@/i18n/t'
import { formatMediaQuery, imageResourceKey, streamResourceKey } from '@/lib/mediaSign'

const SIG_REFRESH_BUFFER_MS = 120_000

export const useAuthStore = defineStore('auth', () => {
  const serverUrl = ref(localStorage.getItem('lz_server_url') || '')
  const token = ref(localStorage.getItem('lz_token') || '')

  /**
   * 리소스 키별 반응형 버전: 서명이 갱신된 리소스를 읽는 computed만 재계산된다.
   * (전역 카운터를 쓰면 배치 서명 한 번에 앱 전체 커버 URL이 재평가되는 문제가 있었음)
   */
  const resourceVersions = reactive(new Map())
  const signatureCache = new Map()

  function trackResourceKey(key) {
    // reactive Map.get은 해당 키만 의존성으로 추적한다
    void resourceVersions.get(key)
  }

  function bumpResourceKey(key) {
    resourceVersions.set(key, (resourceVersions.get(key) || 0) + 1)
  }

  function bumpAllResources() {
    for (const key of [...resourceVersions.keys()]) bumpResourceKey(key)
  }
  const pendingResources = new Map()
  let flushTimer = null
  let signInFlight = null

  watch([serverUrl, token], () => {
    localStorage.setItem('lz_server_url', serverUrl.value)
    localStorage.setItem('lz_token', token.value)
  })

  watch(token, (t) => {
    if (!t) {
      signatureCache.clear()
      pendingResources.clear()
      bumpAllResources()
    }
  })

  const isAuthenticated = computed(() => !!token.value)

  const login = async (password) => {
    try {
      const base = (serverUrl.value || '').replace(/\/$/, '')
      const response = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (!response.ok) {
        let message = t('library.loginFailed', { status: response.status })
        try {
          const errorData = await response.json()
          if (errorData?.error) message = errorData.error
        } catch {
          if (response.status === 403) {
            message = t('library.corsBlocked')
          }
        }
        throw new Error(message)
      }

      const { token: receivedToken } = await response.json()
      signatureCache.clear()
      token.value = receivedToken
      return { success: true }
    } catch (error) {
      console.error('❌ 로그인 오류:', error.message)
      return { success: false, message: error.message }
    }
  }

  const logout = () => {
    token.value = ''
    signatureCache.clear()
    pendingResources.clear()
    bumpAllResources()
  }

  const fetchWithAuth = async (endpoint, options = {}) => {
    const url = endpoint.startsWith('http') ? endpoint : `${serverUrl.value}${endpoint}`

    const defaultOptions = {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token.value}`,
      },
    }

    const response = await fetch(url, defaultOptions)

    if (response.status === 401) {
      logout()
      throw new Error(t('library.sessionExpired'))
    }

    return response
  }

  function cacheEntryValid(entry) {
    return entry && entry.expiresAtMs > Date.now() + SIG_REFRESH_BUFFER_MS
  }

  function normalizeResource(resource) {
    if (resource.kind === 'stream') {
      return { kind: 'stream', id: String(resource.id) }
    }
    if (resource.kind === 'image' && resource.imageType === 'tag') {
      return { kind: 'image', imageType: 'tag', name: String(resource.name) }
    }
    if (resource.kind === 'image') {
      return {
        kind: 'image',
        imageType: String(resource.imageType),
        id: String(resource.id),
      }
    }
    return null
  }

  function resourceToCacheKey(resource) {
    const r = normalizeResource(resource)
    if (!r) return null
    if (r.kind === 'stream') return streamResourceKey(r.id)
    if (r.imageType === 'tag') return imageResourceKey('tag', r.name)
    return imageResourceKey(r.imageType, r.id)
  }

  async function signMediaResources(resources) {
    if (!token.value || !resources.length) return

    const need = []
    for (const raw of resources) {
      const r = normalizeResource(raw)
      if (!r) continue
      const key = resourceToCacheKey(r)
      if (!key || cacheEntryValid(signatureCache.get(key))) continue
      need.push(r)
    }
    if (need.length === 0) return

    if (signInFlight) {
      await signInFlight
      return signMediaResources(need)
    }

    signInFlight = (async () => {
      const res = await fetchWithAuth('/api/auth/media-sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resources: need }),
      })
      if (!res.ok) return
      const data = await res.json()
      const sigs = data?.signatures ?? {}
      for (const [key, { exp, sig }] of Object.entries(sigs)) {
        signatureCache.set(key, {
          exp,
          sig,
          expiresAtMs: Number(exp) * 1000,
        })
        bumpResourceKey(key)
      }
    })()

    try {
      await signInFlight
    } finally {
      signInFlight = null
    }
  }

  function scheduleMediaSign(resource) {
    if (!token.value) return
    const r = normalizeResource(resource)
    if (!r) return
    const key = resourceToCacheKey(r)
    if (!key || cacheEntryValid(signatureCache.get(key))) return
    pendingResources.set(key, r)
    if (flushTimer != null) clearTimeout(flushTimer)
    flushTimer = setTimeout(() => {
      flushTimer = null
      const batch = [...pendingResources.values()]
      pendingResources.clear()
      void signMediaResources(batch)
    }, 40)
  }

  function getMediaQueryByKey(key) {
    const entry = signatureCache.get(key)
    if (!cacheEntryValid(entry)) return ''
    return formatMediaQuery(entry)
  }

  function getImageMediaQuerySync(type, id) {
    if (!id) return ''
    const key = imageResourceKey(type, id)
    trackResourceKey(key)
    return getMediaQueryByKey(key)
  }

  async function ensureImageSignature(type, id) {
    if (!id || !token.value) return ''
    if (type === 'tag') {
      scheduleMediaSign({ kind: 'image', imageType: 'tag', name: id })
    } else {
      scheduleMediaSign({ kind: 'image', imageType: type, id })
    }
    await signMediaResources([
      type === 'tag'
        ? { kind: 'image', imageType: 'tag', name: id }
        : { kind: 'image', imageType: type, id },
    ])
    return getImageMediaQuerySync(type, id)
  }

  function getStreamMediaQuerySync(trackId) {
    if (!trackId) return ''
    const key = streamResourceKey(trackId)
    trackResourceKey(key)
    return getMediaQueryByKey(key)
  }

  async function ensureStreamSignature(trackId) {
    if (!trackId || !token.value) return ''
    const key = streamResourceKey(trackId)
    if (cacheEntryValid(signatureCache.get(key))) {
      return getMediaQueryByKey(key)
    }
    await signMediaResources([{ kind: 'stream', id: trackId }])
    return getMediaQueryByKey(key)
  }

  /** 대기열·목록에서 재생 전 스트림 서명을 한 번에 받아 두기 (재생 시작 지연 감소) */
  async function prefetchStreamSignatures(trackIds) {
    if (!token.value || !Array.isArray(trackIds) || !trackIds.length) return
    const resources = [...new Set(trackIds.map((id) => String(id)).filter(Boolean))].map((id) => ({
      kind: 'stream',
      id,
    }))
    await signMediaResources(resources)
  }

  const IMAGE_SIGN_BATCH = 80

  /** 앨범·아티스트 목록 등 — img src 전에 exp/sig 확보 (첫 진입 401·빈 src 방지) */
  async function prefetchImageSignatures(imageType, ids) {
    if (!token.value || !imageType || !Array.isArray(ids) || !ids.length) return
    const unique = [...new Set(ids.map((id) => String(id)).filter(Boolean))]
    for (let i = 0; i < unique.length; i += IMAGE_SIGN_BATCH) {
      const chunk = unique.slice(i, i + IMAGE_SIGN_BATCH)
      const resources =
        imageType === 'tag'
          ? chunk.map((name) => ({ kind: 'image', imageType: 'tag', name }))
          : chunk.map((id) => ({ kind: 'image', imageType, id }))
      await signMediaResources(resources)
    }
  }

  /** 템플릿·목록용: 서명 요청 후 캐시되면 URL 반환 (해당 리소스 키만 반응형 추적) */
  function coverSrc(type, id) {
    if (!id || !token.value) return ''
    if (type === 'tag') {
      scheduleMediaSign({ kind: 'image', imageType: 'tag', name: id })
    } else {
      scheduleMediaSign({ kind: 'image', imageType: type, id })
    }
    const q = getImageMediaQuerySync(type, id)
    return getCoverUrl(serverUrl.value ?? '', type, id, q)
  }

  function invalidateImageCache(type, id) {
    if (!id) return
    const key = imageResourceKey(type, id)
    signatureCache.delete(key)
    pendingResources.delete(key)
    bumpResourceKey(key)
  }

  return {
    serverUrl,
    token,
    isAuthenticated,
    login,
    logout,
    fetchWithAuth,
    scheduleMediaSign,
    signMediaResources,
    ensureImageSignature,
    ensureStreamSignature,
    getStreamMediaQuerySync,
    prefetchStreamSignatures,
    prefetchImageSignatures,
    getImageMediaQuerySync,
    invalidateImageCache,
    coverSrc,
  }
})
