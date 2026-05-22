import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

/** 라우트 meta.requiresAuth + 로그인 여부로 AuthEmptyState 표시 여부 */
export function useRequiresAuth() {
  const route = useRoute()
  const auth = useAuthStore()
  const requiresAuth = computed(() => route.meta.requiresAuth === true)
  const showAuthEmpty = computed(() => requiresAuth.value && !auth.isAuthenticated)
  return { auth, requiresAuth, showAuthEmpty }
}
