import { postUploadStagingHandler } from '../handlers/upload.staging.post.js';
import { postUploadCommitHandler } from '../handlers/upload.commit.post.js';
import { deleteUploadStagingHandler } from '../handlers/upload.staging.delete.js';

export default async function uploadRoutes(fastify) {
  fastify.post('/api/upload/staging', {
    config: { rateLimit: { max: 60, timeWindow: '1 hour' } },
  }, postUploadStagingHandler);

  fastify.post('/api/upload/commit', {
    config: { rateLimit: { max: 30, timeWindow: '1 hour' } },
  }, postUploadCommitHandler);

  fastify.delete('/api/upload/staging/:id', deleteUploadStagingHandler);
}
