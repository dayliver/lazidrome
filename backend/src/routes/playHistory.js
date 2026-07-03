import { getPlayHistoryHandler } from '../handlers/playHistory.get.js';

export default async function playHistoryRoutes(fastify) {
  fastify.get('/api/play-history', { preHandler: [fastify.authenticate] }, getPlayHistoryHandler);
}
