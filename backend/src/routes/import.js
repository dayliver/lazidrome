import { postImportYoutubeResolveHandler } from '../handlers/import.youtube.resolve.post.js';
import { postImportYoutubeStartHandler } from '../handlers/import.youtube.start.post.js';
import { getImportYoutubeJobHandler } from '../handlers/import.youtube.status.get.js';

export default async function importRoutes(fastify) {
  fastify.post('/api/import/youtube/resolve', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, postImportYoutubeResolveHandler);

  // 동시 실행은 youtubeJobManager가 1건으로 이미 막는다. 여기서는 IP당 폭주만 억제하면 되고,
  // 유효성 실패(400)·작업 중(409)도 카운트에 잡히므로 앨범 단위 작업이 막히지 않을 만큼은 열어둔다.
  fastify.post('/api/import/youtube/start', {
    config: { rateLimit: { max: 30, timeWindow: '1 hour' } },
  }, postImportYoutubeStartHandler);

  fastify.get('/api/import/youtube/jobs/:id', getImportYoutubeJobHandler);
}
