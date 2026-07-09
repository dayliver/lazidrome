import { getFrequentVisits } from '../services/pageVisitsService.js';
import { getStatsTopPayload } from '../repositories/statsRepository.js';

function parseTagsRows(rows) {
  return rows.map((t) => ({ ...t, tags: JSON.parse(t.tags || '[]') }));
}

/** 홈 대시보드: frequent visits + 7d top tracks/artists (1회 요청) */
export async function getHomeDashboardHandler(request, reply) {
  try {
    const visitLimit = Math.min(50, Math.max(1, Number(request.query?.visitLimit) || 24));
    const topLimit = Math.min(50, Math.max(1, Number(request.query?.limit) || 20));
    const timezone = request.query?.timezone;

    const frequentVisits = getFrequentVisits(visitLimit);
    const payload = getStatsTopPayload('7d', topLimit, timezone, {
      tracks: true,
      artists: true,
      albums: false,
      totals: false,
    });

    return {
      success: true,
      data: {
        frequentVisits,
        topTracks: parseTagsRows(payload?.tracks || []),
        topArtists: payload?.artists || [],
        range: '7d',
        limit: topLimit,
      },
    };
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ success: false, error: '홈 대시보드 조회 중 오류가 발생했습니다.' });
  }
}
