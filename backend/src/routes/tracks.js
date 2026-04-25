import { getTracksHandler } from '../handlers/tracks.get.js';
import { patchTrackRatingHandler } from '../handlers/tracks.rate.js';
import { patchTrackHandler } from '../handlers/tracks.patch.js';
import { enrichTrackHandler } from '../handlers/tracks.enrich.js';

export default async function trackRoutes(fastify) {
  fastify.get('/api/tracks', getTracksHandler);
  fastify.patch('/api/tracks/:id/rate', patchTrackRatingHandler);
  fastify.patch('/api/tracks/:id', patchTrackHandler);
  fastify.post('/api/tracks/:id/enrich', enrichTrackHandler);
}