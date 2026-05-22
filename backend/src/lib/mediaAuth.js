import { parseMediaResourceFromRequest, verifyMediaSignature } from './mediaSign.js';

/**
 * 스트림·이미지: 단기 서명(exp/sig) 또는 레거시 JWT(쿼리/Bearer).
 */
export function hasMediaOrJwtAccess(request, jwtSecret) {
  const resource = parseMediaResourceFromRequest(request);
  if (resource && verifyMediaSignature(request.query, resource, jwtSecret)) {
    return true;
  }

  const jwtApi = request.server?.jwt;
  if (!jwtApi?.verify) return false;

  try {
    const q = request.query?.token;
    if (q) {
      jwtApi.verify(q);
      return true;
    }
    const auth = request.headers?.authorization;
    if (auth?.startsWith('Bearer ')) {
      jwtApi.verify(auth.slice(7));
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function isImageApiRoute(method, routerPath) {
  return method === 'GET' && routerPath?.startsWith('/api/images');
}
