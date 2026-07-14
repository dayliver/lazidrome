import { getArtistsHandler } from '../handlers/artists.get.js';
import { getArtistDetailHandler } from '../handlers/artists.detail.js';
import { enrichArtistHandler } from '../handlers/artists.enrich.js';
import { patchArtistHandler } from '../handlers/artists.patch.js';
import { deleteArtistHandler } from '../handlers/artists.delete.js';

export default async function artistRoutes(fastify) {
  fastify.get('/api/artists', getArtistsHandler);
  fastify.get('/api/artists/:id', getArtistDetailHandler);
  fastify.post(
    '/api/artists/:id/enrich',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    enrichArtistHandler,
  );
  fastify.patch('/api/artists/:id', patchArtistHandler);
  fastify.delete('/api/artists/:id', { preHandler: [fastify.authenticate] }, deleteArtistHandler);
}
