import { getHomeShelvesHandler } from '../handlers/home.shelves.get.js';
import { getHomeDashboardHandler } from '../handlers/home.dashboard.get.js';

export default async function homeRoutes(fastify) {
  fastify.get('/api/home/shelves', { preHandler: [fastify.authenticate] }, getHomeShelvesHandler);
  fastify.get('/api/home', { preHandler: [fastify.authenticate] }, getHomeDashboardHandler);
}
