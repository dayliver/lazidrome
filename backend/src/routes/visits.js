import { postVisitHandler } from '../handlers/visits.post.js';
import { getFrequentVisitsHandler } from '../handlers/visits.frequent.get.js';
import { postVisitsImportHandler } from '../handlers/visits.import.post.js';
import { postVisitsClearHandler } from '../handlers/visits.clear.post.js';

export default async function visitsRoutes(fastify) {
  fastify.post('/api/visits', {
    config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
  }, postVisitHandler);

  fastify.get('/api/visits/frequent', getFrequentVisitsHandler);

  fastify.post('/api/visits/import', {
    config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
  }, postVisitsImportHandler);

  fastify.post('/api/visits/clear', {
    config: { rateLimit: { max: 3, timeWindow: '1 hour' } },
  }, postVisitsClearHandler);
}
