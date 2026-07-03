import { listPlayHistory } from '../repositories/playHistoryRepository.js';

export async function getPlayHistoryHandler(request, reply) {
  try {
    const limit = request.query?.limit;
    const offset = request.query?.offset;
    const data = listPlayHistory({ limit, offset });
    return { success: true, data };
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ success: false, error: '청취 기록을 불러오지 못했습니다.' });
  }
}
