import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  // --- 1. 상태 (State) ---
  // 서버 주소와 인증 토큰만 기억하면 됩니다.
  const serverUrl = ref(localStorage.getItem('lz_server_url') || 'http://localhost:5294')
  const token = ref(localStorage.getItem('lz_token') || '')

  // --- 2. 반응형 설정 (Watch) ---
  watch([serverUrl, token], () => {
    localStorage.setItem('lz_server_url', serverUrl.value)
    localStorage.setItem('lz_token', token.value)
  })

  // --- 3. 게터 (Getters) ---
  const isAuthenticated = computed(() => !!token.value)

  // --- 4. 액션 (Actions) ---

  /**
   * 마스터 비밀번호로 로그인하여 JWT 토큰을 발급받습니다.
   */
  const login = async (password) => {
    try {
      const response = await fetch(`${serverUrl.value}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '로그인 실패')
      }

      const { token: receivedToken } = await response.json()
      token.value = receivedToken
      return { success: true }
    } catch (error) {
      console.error('❌ 로그인 오류:', error.message)
      return { success: false, message: error.message }
    }
  }

  /**
   * 로그아웃: 토큰을 폐기합니다.
   */
  const logout = () => {
    token.value = ''
    // 필요하다면 초기화 후 홈으로 리다이렉트 로직 추가
  }

  /**
   * [도우미] 인증 헤더가 포함된 fetch 요청
   */
  const fetchWithAuth = async (endpoint, options = {}) => {
    const url = endpoint.startsWith('http') ? endpoint : `${serverUrl.value}${endpoint}`
    
    const defaultOptions = {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token.value}`
      }
    }

    const response = await fetch(url, defaultOptions)
    
    // 만약 토큰이 만료(401)되었다면 자동 로그아웃 처리
    if (response.status === 401) {
      logout()
      throw new Error('인증 세션이 만료되었습니다. 다시 로그인해주세요.')
    }

    return response
  }

  return { 
    serverUrl, 
    token, 
    isAuthenticated, 
    login, 
    logout, 
    fetchWithAuth
  }
})