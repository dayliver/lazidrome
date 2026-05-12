import {
  findRecentPlayedTracks,
  findRediscoverTracks,
  findMostPlayedTracks,
  findStarredTracks,
} from '../repositories/homeRepository.js';

const WINDOWS = new Set(['24h', '48h', '7d']);

function parseTagsRows(rows) {
  return rows.map((t) => ({ ...t, tags: JSON.parse(t.tags || '[]') }));
}

export async function getHomeShelvesHandler(request, reply) {
  const raw = request.query?.window;
  const windowKey = WINDOWS.has(raw) ? raw : '7d';
  const limitRaw = request.query?.limit;
  const limit = Math.min(50, Math.max(4, Number(limitRaw) || 20));
  const shelfCap = 20;

  try {
    const mostPlayed = parseTagsRows(findMostPlayedTracks(shelfCap));
    const recentPlays = parseTagsRows(findRecentPlayedTracks(windowKey, shelfCap));
    const rediscover = parseTagsRows(findRediscoverTracks(windowKey, shelfCap));
    const starred = parseTagsRows(findStarredTracks(shelfCap));

    return {
      window: windowKey,
      limit,
      shelves: {
        mostPlayed,
        recentPlays,
        rediscover,
        starred,
      },
    };
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: '홈 선반 데이터 조회 중 서버 오류가 발생했습니다.' });
  }
}
