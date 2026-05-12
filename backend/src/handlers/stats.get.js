import {
  getPlayStatsPayload,
  getTopTracksByPlayEvents,
  getTopAlbumsByPlayEvents,
  RANGES,
} from '../repositories/statsRepository.js';

function parseTagsRows(rows) {
  return rows.map((t) => ({ ...t, tags: JSON.parse(t.tags || '[]') }));
}

export async function getStatsPlaysHandler(request, reply) {
  const raw = request.query?.range;
  const range = RANGES.has(raw) ? raw : '7d';
  const payload = getPlayStatsPayload(range);
  return { success: true, data: payload };
}

export async function getStatsTopHandler(request, reply) {
  const raw = request.query?.range;
  const range = RANGES.has(raw) ? raw : '7d';
  const limit = Math.min(50, Math.max(1, Number(request.query?.limit) || 12));
  try {
    const tracks = parseTagsRows(getTopTracksByPlayEvents(range, limit));
    const albums = getTopAlbumsByPlayEvents(range, limit);
    return { success: true, data: { range, limit, tracks, albums } };
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ success: false, error: '통계 상위 목록 조회 중 오류가 발생했습니다.' });
  }
}
