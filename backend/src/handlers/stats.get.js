import {
  getPlayStatsPayload,
  getHabitStatsPayload,
  getTopTracksByPlayEvents,
  getTopAlbumsByPlayEvents,
  RANGES,
  CHART_RANGES,
  HABIT_RANGES,
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

export async function getStatsHabitsHandler(request, reply) {
  const raw = request.query?.range;
  const range = HABIT_RANGES.has(raw) ? raw : '30d';
  const timezone = request.query?.timezone;
  const payload = getHabitStatsPayload(range, timezone);
  if (!payload) {
    return reply.code(400).send({ success: false, error: '유효하지 않은 range입니다.' });
  }
  return { success: true, data: payload };
}

export async function getStatsTopHandler(request, reply) {
  const raw = request.query?.range;
  const range = CHART_RANGES.has(raw) ? raw : RANGES.has(raw) ? raw : '7d';
  const limit = Math.min(50, Math.max(1, Number(request.query?.limit) || 12));
  try {
    const timezone = request.query?.timezone;
    const tracks = parseTagsRows(getTopTracksByPlayEvents(range, limit, timezone));
    const albums = getTopAlbumsByPlayEvents(range, limit, timezone);
    return { success: true, data: { range, limit, tracks, albums } };
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ success: false, error: '통계 상위 목록 조회 중 오류가 발생했습니다.' });
  }
}
