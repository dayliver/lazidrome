import { stageUploadedFile } from '../services/uploadStagingService.js';

/** POST /api/upload/staging (multipart file) */
export async function postUploadStagingHandler(request, reply) {
  try {
    const fileData = await request.file();
    if (!fileData) {
      return reply.code(400).send({ error: '업로드된 파일이 없습니다.' });
    }
    const data = await stageUploadedFile(fileData);
    return { success: true, data };
  } catch (err) {
    const code = err.statusCode ?? 500;
    if (code >= 400 && code < 500) {
      return reply.code(code).send({ error: err.message || 'Invalid request' });
    }
    request.log.error(err, 'upload staging failed');
    return reply.code(500).send({ error: '임시 업로드 중 오류가 발생했습니다.' });
  }
}
