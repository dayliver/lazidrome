import { postImportYoutubeResolveHandler } from '../handlers/import.youtube.resolve.post.js';
import { postImportYoutubeStartHandler } from '../handlers/import.youtube.start.post.js';
import { getImportYoutubeJobHandler } from '../handlers/import.youtube.status.get.js';

export default async function importRoutes(fastify) {
  fastify.post('/api/import/youtube/resolve', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, postImportYoutubeResolveHandler);

  fastify.post('/api/import/youtube/start', {
    config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
  }, postImportYoutubeStartHandler);

  fastify.get('/api/import/youtube/jobs/:id', getImportYoutubeJobHandler);
}
