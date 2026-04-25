import { findAllTracks } from '../repositories/trackRepository.js';

export async function getTracksHandler(request, reply) {
  try {
    const tracks = findAllTracks();
    return tracks.map(t => ({ ...t, tags: JSON.parse(t.tags || '[]') }));
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: '트랙 목록 조회 중 서버 오류 발생' });
  }
}