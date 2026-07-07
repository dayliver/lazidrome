import { getAlbumsHandler } from '../handlers/albums.get.js';
import { getAlbumDetailHandler } from '../handlers/albums.detail.js';
import { patchAlbumHandler } from '../handlers/albums.patch.js';
import { enrichAlbumHandler } from '../handlers/albums.enrich.js';
import { postAlbumHandler } from '../handlers/albums.post.js';

export default async function albumRoutes(fastify) {
  fastify.get('/api/albums', getAlbumsHandler);
  fastify.post('/api/albums', { preHandler: [fastify.authenticate] }, postAlbumHandler);
  fastify.get('/api/albums/:id', getAlbumDetailHandler);
  fastify.patch('/api/albums/:id', patchAlbumHandler);
  fastify.post('/api/albums/:id/enrich', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, enrichAlbumHandler);
}