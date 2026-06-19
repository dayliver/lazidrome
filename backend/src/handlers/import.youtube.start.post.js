import { isYoutubeUrl } from '../lib/youtubeUrl.js';
import { createJob, hasActiveJob } from '../services/youtubeJobManager.js';

export async function postImportYoutubeStartHandler(request, reply) {
  const body = request.body ?? {};
  const { url, items } = body;

  if (!url || typeof url !== 'string' || !isYoutubeUrl(url)) {
    return reply.code(400).send({ success: false, error: '유효한 YouTube URL이 필요합니다.' });
  }
  if (!Array.isArray(items) || !items.length) {
    return reply.code(400).send({ success: false, error: '가져올 항목이 필요합니다.' });
  }

  if (hasActiveJob()) {
    return reply.code(409).send({
      success: false,
      error: '다른 가져오기 작업이 진행 중입니다.',
    });
  }

  const normalized = items.map((item, idx) => ({
    videoId: String(item.videoId || ''),
    webpageUrl: item.webpageUrl || undefined,
    title: String(item.title || `Track ${idx + 1}`).trim(),
    artist: item.artist != null ? String(item.artist).trim() : '',
    album: item.album != null ? String(item.album).trim() : '',
    trackNo: item.trackNo != null && item.trackNo !== '' ? Number(item.trackNo) : undefined,
    selected: item.selected !== false,
  })).filter((i) => i.videoId);

  const result = createJob({ sourceUrl: url, items: normalized });

  if (result.error === 'BUSY') {
    return reply.code(409).send({ success: false, error: result.message });
  }
  if (result.error === 'EMPTY') {
    return reply.code(400).send({ success: false, error: result.message });
  }

  return { success: true, data: { jobId: result.jobId } };
}
