import { processAudioUpload } from '../services/uploadService.js';

export async function uploadTrackHandler(request, reply) {
  try {
    // 1. multipart 파일 받아오기
    const fileData = await request.file();
    if (!fileData) {
      return reply.code(400).send({ error: '업로드된 파일이 없습니다.' });
    }

    // 2. Service에 파일 처리 위임
    const { trackId, title } = await processAudioUpload(fileData);

    // 3. 성공 응답
    return { 
      success: true, 
      trackId, 
      title,
      message: '음원이 성공적으로 업로드되었습니다.' 
    };

  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: '업로드 및 처리 중 서버 오류가 발생했습니다.' });
  }
}