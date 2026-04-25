import { getTagsHandler } from '../handlers/tags.get.js';
import { clearTagCacheHandler } from '../handlers/tags.clearCache.js';

export default async function tagRoutes(fastify) {
  fastify.get('/api/tags', getTagsHandler);
  fastify.post('/api/tags/clear-cache', clearTagCacheHandler);
}