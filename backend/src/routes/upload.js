import { uploadTrackHandler } from '../handlers/upload.post.js';

export default async function uploadRoutes(fastify) {
  fastify.post('/api/tracks/upload', uploadTrackHandler);
}