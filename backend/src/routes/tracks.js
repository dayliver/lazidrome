import { getTracksHandler } from '../handlers/tracks.get.js';
import { getTrackDetailHandler } from '../handlers/tracks.detail.js';
import { postTrackPlayHandler } from '../handlers/tracks.play.js';
import { patchTrackRatingHandler } from '../handlers/tracks.rate.js';
import { patchTracksTagsBulkHandler } from '../handlers/tracks.tags.bulk.js';
import { patchTrackHandler } from '../handlers/tracks.patch.js';
import { enrichTrackHandler } from '../handlers/tracks.enrich.js';
import { postTrackReplaceAudioHandler } from '../handlers/tracks.replaceAudio.post.js';

export default async function trackRoutes(fastify) {
  fastify.get('/api/tracks', getTracksHandler);
  fastify.get('/api/tracks/:id', getTrackDetailHandler);
  fastify.post('/api/tracks/:id/play', { preHandler: [fastify.authenticate] }, postTrackPlayHandler);
  // 정적 세그먼트라 /api/tracks/:id/rate 보다 먼저 잡힌다
  fastify.patch('/api/tracks/tags/bulk', patchTracksTagsBulkHandler);
  fastify.patch('/api/tracks/:id/rate', patchTrackRatingHandler);
  fastify.patch('/api/tracks/:id', patchTrackHandler);
  fastify.post('/api/tracks/:id/replace-audio', {
    config: { rateLimit: { max: 20, timeWindow: '1 hour' } },
  }, postTrackReplaceAudioHandler);
  fastify.post('/api/tracks/:id/enrich', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, enrichTrackHandler);
}