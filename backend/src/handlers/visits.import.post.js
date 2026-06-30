import { replyHttpError } from '../lib/httpErrors.js';
import { importPageVisits } from '../services/pageVisitsService.js';

export async function postVisitsImportHandler(request, reply) {
  try {
    const { visits } = request.body ?? {};
    const result = importPageVisits(visits);
    return { success: true, ...result };
  } catch (err) {
    const statusCode = err.statusCode === 400 ? 400 : 500;
    return replyHttpError(request, reply, err, {
      statusCode,
      fallback: '방문 기록 가져오기 중 오류가 발생했습니다.',
    });
  }
}
