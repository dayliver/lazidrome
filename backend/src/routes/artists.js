import { getArtistsHandler } from '../handlers/artists.get.js';
import { getArtistDetailHandler } from '../handlers/artists.detail.js';
import { enrichArtistHandler } from '../handlers/artists.enrich.js';
import { patchArtistHandler } from '../handlers/artists.patch.js';

export default async function artistRoutes(fastify) {
  fastify.get('/api/artists', getArtistsHandler);
  fastify.get('/api/artists/:id', getArtistDetailHandler);
  fastify.post('/api/artists/:id/enrich', enrichArtistHandler);
  fastify.patch('/api/artists/:id', patchArtistHandler);
}