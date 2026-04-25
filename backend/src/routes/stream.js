import { streamTrackHandler } from '../handlers/stream.get.js';

export default async function streamRoutes(fastify) {
  fastify.get('/api/stream/:id', streamTrackHandler);
}