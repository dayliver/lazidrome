import { isYoutubeUrl } from '../lib/youtubeUrl.js';
import { replyHttpError } from '../lib/httpErrors.js';
import { replaceTrackAudio } from '../services/trackReplaceService.js';

export async function postTrackReplaceAudioHandler(request, reply) {
  const { id } = request.params;
  const body = request.body ?? {};
  const source = String(body.source ?? '').trim();

  if (source !== 'staging' && source !== 'youtube') {
    return reply.code(400).send({ success: false, error: 'source는 staging 또는 youtube여야 합니다.' });
  }

  if (source === 'youtube') {
    const url = body.url != null ? String(body.url).trim() : '';
    if (url && !isYoutubeUrl(url)) {
      return reply.code(400).send({ success: false, error: '유효한 YouTube URL이 필요합니다.' });
    }
    if (!url && !body.videoId) {
      return reply.code(400).send({ success: false, error: 'YouTube URL 또는 videoId가 필요합니다.' });
    }
  }

  if (source === 'staging' && !body.stagingId) {
    return reply.code(400).send({ success: false, error: 'stagingId가 필요합니다.' });
  }

  try {
    const data = await replaceTrackAudio(id, {
      source,
      stagingId: body.stagingId,
      url: body.url,
      videoId: body.videoId,
      webpageUrl: body.webpageUrl,
    });
    return { success: true, data };
  } catch (err) {
    const code = err?.statusCode ?? 500;
    if (code >= 400 && code < 500) {
      return reply.code(code).send({ success: false, error: err.message || 'Invalid request' });
    }
    return replyHttpError(request, reply, err, { fallback: '음원 교체 중 오류가 발생했습니다.' });
  }
}
