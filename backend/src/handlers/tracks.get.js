import {
  countTracksFiltered,
  findAllTracks,
  findTracksPage,
  findTracksByIds,
  searchTracks,
} from '../repositories/trackRepository.js';

const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 200;

function mapTrackRow(t) {
  return { ...t, tags: JSON.parse(t.tags || '[]') };
}

function parsePageQuery(query) {
  const hasLimit = query.limit !== undefined && query.limit !== '';
  const hasOffset = query.offset !== undefined && query.offset !== '';

  if (!hasLimit && !hasOffset) return null;

  const limit = Math.min(
    MAX_PAGE_LIMIT,
    Math.max(1, parseInt(String(query.limit ?? DEFAULT_PAGE_LIMIT), 10) || DEFAULT_PAGE_LIMIT)
  );
  const offset = Math.max(0, parseInt(String(query.offset ?? '0'), 10) || 0);

  return { limit, offset };
}

export async function getTracksHandler(request, reply) {
  try {
    const { q, ids } = request.query ?? {};

    if (typeof ids === 'string' && ids.trim()) {
      const idList = ids.split(',').map((s) => s.trim()).filter(Boolean);
      const items = findTracksByIds(idList).map(mapTrackRow);
      return { items, total: items.length, offset: 0, limit: items.length, hasMore: false };
    }

    const page = parsePageQuery(request.query ?? {});
    if (page) {
      const { offset, limit } = page;
      const total = countTracksFiltered(request.query ?? {});
      const rows = findTracksPage(offset, limit, request.query ?? {});
      const items = rows.map(mapTrackRow);
      return {
        items,
        total,
        offset,
        limit,
        hasMore: offset + items.length < total,
      };
    }

    if (typeof q === 'string' && q.trim()) {
      const searchLimit = Math.min(
        50,
        Math.max(1, parseInt(String(request.query.limit ?? '10'), 10) || 10)
      );
      const items = searchTracks(q.trim(), searchLimit).map(mapTrackRow);
      return { items, total: items.length, offset: 0, limit: searchLimit, hasMore: false };
    }

    // 레거시: 쿼리 없으면 전체 배열 (기존 클라이언트 호환)
    const tracks = findAllTracks();
    return tracks.map(mapTrackRow);
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: '트랙 목록 조회 중 서버 오류 발생' });
  }
}
