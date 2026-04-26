import { getTagsHandler } from '../handlers/tags.get.js';
import { getTagDetailHandler } from '../handlers/tags.detail.get.js';
import { patchTagRenameHandler } from '../handlers/tags.rename.patch.js';
import { postTagImageHandler } from '../handlers/tags.image.post.js';
import { clearTagCacheHandler } from '../handlers/tags.clearCache.js';

export default async function tagRoutes(fastify) {
  fastify.get('/api/tags', getTagsHandler);
  fastify.get('/api/tags/detail', getTagDetailHandler);
  fastify.patch('/api/tags/rename', patchTagRenameHandler);
  fastify.post('/api/tags/image', postTagImageHandler);
  fastify.post('/api/tags/clear-cache', clearTagCacheHandler);
}