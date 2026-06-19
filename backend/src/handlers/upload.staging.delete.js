import { cancelStagedUpload } from '../services/uploadStagingService.js';

/** DELETE /api/upload/staging/:id */
export async function deleteUploadStagingHandler(request, reply) {
  try {
    const { id } = request.params;
    return cancelStagedUpload(id);
  } catch (err) {
    const code = err.statusCode ?? 500;
    if (code >= 400 && code < 500) {
      return reply.code(code).send({ error: err.message || 'Invalid request' });
    }
    request.log.error(err, 'upload staging cancel failed');
    return reply.code(500).send({ error: '임시 업로드를 취소하지 못했습니다.' });
  }
}
