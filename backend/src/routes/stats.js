import {
  getStatsPlaysHandler,
  getStatsHabitsHandler,
  getStatsTopHandler,
} from '../handlers/stats.get.js';

export default async function statsRoutes(fastify) {
  fastify.get('/api/stats/plays', { preHandler: [fastify.authenticate] }, getStatsPlaysHandler);
  fastify.get('/api/stats/habits', { preHandler: [fastify.authenticate] }, getStatsHabitsHandler);
  fastify.get('/api/stats/top', { preHandler: [fastify.authenticate] }, getStatsTopHandler);
}
