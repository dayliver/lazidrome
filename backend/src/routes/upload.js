import { uploadTrackHandler } from '../handlers/upload.post.js';

export default async function uploadRoutes(fastify) {
  fastify.post('/api/tracks/upload', {
    config: { rateLimit: { max: 15, timeWindow: '1 hour' } },
  }, uploadTrackHandler);
}