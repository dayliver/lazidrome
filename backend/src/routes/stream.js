import { streamTrackHandler } from '../handlers/stream.get.js';
import { createStreamPlaylistHandler } from '../handlers/stream.playlist.get.js';

export default async function streamRoutes(fastify) {
  const secret = fastify.mediaSigningSecret;
  const ttl = Number(process.env.MEDIA_TOKEN_TTL_SEC) || 7200;

  fastify.get('/api/stream/:id', streamTrackHandler);
  fastify.get('/api/stream/playlist.m3u8', createStreamPlaylistHandler(secret, ttl));
}