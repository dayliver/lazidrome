import { deleteTrack } from '../services/trackDeleteService.js';

/**
 * DELETE /api/tracks/:id
 * 트랙 메타·파일·커스텀 커버를 삭제하고 빈 앨범/고아 아티스트를 정리한다.
 */
export async function deleteTrackHandler(request, reply) {
  const { id } = request.params;
  try {
    const data = deleteTrack(id);
    return { success: true, data };
  } catch (err) {
    const code = Number(err?.statusCode) || 500;
    if (code === 404) {
      return reply.code(404).send({ success: false, error: 'Not found' });
    }
    request.log.error(err);
    return reply.code(500).send({ success: false, error: '트랙 삭제 중 오류가 발생했습니다.' });
  }
}
