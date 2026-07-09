import { updateTrackRating } from '../repositories/trackRepository.js';
import { clearTagCache } from '../services/tagService.js';

export async function patchTrackRatingHandler(request, reply) {
  const { id } = request.params;
  const { rating, tags, starred } = request.body;

  try {
    const changes = updateTrackRating(id, { rating, tags, starred });
    if (changes > 0 && tags !== undefined) clearTagCache();
    if (changes === 0) return reply.code(404).send({ error: 'Track not found' });
    return { success: true };
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: '업데이트 중 오류가 발생했습니다.' });
  }
}