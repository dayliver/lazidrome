import { getAlbumsHandler } from '../handlers/albums.get.js';
import { getAlbumDetailHandler } from '../handlers/albums.detail.js';
import { patchAlbumHandler } from '../handlers/albums.patch.js';
import { enrichAlbumHandler } from '../handlers/albums.enrich.js';

export default async function albumRoutes(fastify) {
  fastify.get('/api/albums', getAlbumsHandler);
  fastify.get('/api/albums/:id', getAlbumDetailHandler);
  fastify.patch('/api/albums/:id', patchAlbumHandler);
  fastify.post('/api/albums/:id/enrich', enrichAlbumHandler);
}