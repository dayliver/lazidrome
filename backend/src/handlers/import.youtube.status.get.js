import { getJob } from '../services/youtubeJobManager.js';

export async function getImportYoutubeJobHandler(request, reply) {
  const { id } = request.params;
  const job = getJob(id);
  if (!job) {
    return reply.code(404).send({ success: false, error: '작업을 찾을 수 없습니다.' });
  }
  return { success: true, data: job };
}
