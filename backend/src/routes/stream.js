import { streamTrackHandler } from '../handlers/stream.get.js';
import { createStreamPlaylistHandler } from '../handlers/stream.playlist.get.js';
import { streamContinuousHandler } from '../handlers/stream.continuous.get.js';

export default async function streamRoutes(fastify) {
  const secret = fastify.mediaSigningSecret;
  const ttl = Number(process.env.MEDIA_TOKEN_TTL_SEC) || 7200;

  // Static paths with a file-like suffix — bare names can lose to /api/stream/:id in find-my-way.
  fastify.get('/api/stream/continuous.mp3', streamContinuousHandler);
  fastify.get('/api/stream/playlist.m3u8', createStreamPlaylistHandler(secret, ttl));
  fastify.get('/api/stream/:id', streamTrackHandler);
}
