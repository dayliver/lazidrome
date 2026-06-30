/**
 * 전역 preHandler에서 인증 생략할 경로.
 * routerPath 기준 (Fastify 등록 URL 패턴).
 */

export function isPublicApiRoute(method, routerPath) {
  if (!routerPath?.startsWith('/api')) return true;

  if (routerPath === '/api' && method === 'GET') return true;
  if (routerPath === '/api/auth/login' && method === 'POST') return true;

  // 스트림: 핸들러가 서명/JWT 유무로 전체/프리뷰 분기 (무자격 시 프리뷰만)
  if (method === 'GET' && routerPath === '/api/stream/:id') return true;

  // 이미지: 핸들러·라우트 훅에서 exp/sig 또는 JWT 검증
  if (method === 'GET' && routerPath?.startsWith('/api/images')) return true;

  // WebSocket: 쿼리 token으로 핸들러에서 JWT 검증
  if (routerPath === '/api/playback/ws') return true;

  return false;
}
