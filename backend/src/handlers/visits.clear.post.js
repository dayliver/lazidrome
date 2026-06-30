import { replyHttpError } from '../lib/httpErrors.js';
import { clearAllPageVisits } from '../services/pageVisitsService.js';

/** localStorage import로 DB가 오염된 경우 1회 초기화 (클라이언트 마이그레이션용) */
export async function postVisitsClearHandler(request, reply) {
  try {
    const result = clearAllPageVisits();
    return { success: true, ...result };
  } catch (err) {
    return replyHttpError(request, reply, err, {
      fallback: '방문 기록 초기화 중 오류가 발생했습니다.',
    });
  }
}
