import { isYoutubeUrl } from '../lib/youtubeUrl.js';
import { resolveYoutubeUrl } from '../services/youtubeImportService.js';

export async function postImportYoutubeResolveHandler(request, reply) {
  const { url } = request.body ?? {};
  if (!url || typeof url !== 'string' || !isYoutubeUrl(url)) {
    return reply.code(400).send({ success: false, error: '유효한 YouTube URL이 필요합니다.' });
  }

  try {
    const data = await resolveYoutubeUrl(url);
    return { success: true, data };
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({
      success: false,
      error: err?.message || 'YouTube 정보를 가져오지 못했습니다.',
    });
  }
}
