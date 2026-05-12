import { getHomeShelvesHandler } from '../handlers/home.shelves.get.js';

export default async function homeRoutes(fastify) {
  fastify.get('/api/home/shelves', { preHandler: [fastify.authenticate] }, getHomeShelvesHandler);
}
