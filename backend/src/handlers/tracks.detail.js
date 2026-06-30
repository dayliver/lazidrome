import { findTrackDetailById } from '../repositories/trackRepository.js';
import { formatTrackDetail } from '../services/trackService.js';

export async function getTrackDetailHandler(request, reply) {
  const { id } = request.params;
  try {
    const raw = findTrackDetailById(id);
    if (!raw) return reply.code(404).send({ error: 'Track not found' });
    return formatTrackDetail(raw);
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: '트랙 상세 정보 조회 중 오류 발생' });
  }
}
