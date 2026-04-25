import { lastfmService } from '../services/lastfmService.js';

export async function externalAlbumSearchHandler(request, reply) {
  const { query } = request.query;
  
  if (!query) {
    return reply.code(400).send({ error: '검색어(query)가 필요합니다.' });
  }

  try {
    // 비즈니스 로직(fetch)은 Service에게 완벽히 위임!
    const results = await lastfmService.searchAlbums(query);
    return results;
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: '외부 앨범 검색 중 서버 오류 발생' });
  }
}