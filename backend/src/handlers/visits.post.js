import { replyHttpError } from '../lib/httpErrors.js';
import { recordPageVisit } from '../services/pageVisitsService.js';

export async function postVisitHandler(request, reply) {
  try {
    const { type, id } = request.body ?? {};
    const result = recordPageVisit(type, id);
    return { success: true, ...result };
  } catch (err) {
    const statusCode = err.statusCode === 400 ? 400 : 500;
    return replyHttpError(request, reply, err, {
      statusCode,
      fallback: '방문 기록 저장 중 오류가 발생했습니다.',
    });
  }
}
