import { replyHttpError } from '../lib/httpErrors.js';
import { getFrequentVisits } from '../services/pageVisitsService.js';

export async function getFrequentVisitsHandler(request, reply) {
  try {
    const limitRaw = request.query?.limit;
    const limit = Math.min(50, Math.max(1, Number(limitRaw) || 24));
    const data = getFrequentVisits(limit);
    return { success: true, data };
  } catch (err) {
    return replyHttpError(request, reply, err, {
      fallback: '자주 찾은 항목 조회 중 오류가 발생했습니다.',
    });
  }
}
