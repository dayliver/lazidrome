import { externalAlbumSearchHandler } from '../handlers/search.external.js';

export default async function searchRoutes(fastify) {
  // GET /api/search/external/album
  fastify.get('/api/search/external/album', {
    config: { rateLimit: { max: 40, timeWindow: '1 minute' } },
  }, externalAlbumSearchHandler);
  
  // (나중에 확장하기 아주 좋습니다)
  // fastify.get('/api/search/local', localSearchHandler); 
}