import { deleteArtist } from '../services/artistService.js';

/**
 * DELETE /api/artists/:id
 * 아티스트 삭제. 연결된 곡/앨범 크레딧은 unlink 후 아티스트 행 제거.
 */
export async function deleteArtistHandler(request, reply) {
  const { id } = request.params;
  try {
    const data = deleteArtist(id);
    return { success: true, data };
  } catch (err) {
    const code = Number(err?.statusCode) || 500;
    if (code === 404) {
      return reply.code(404).send({ success: false, error: 'Not found' });
    }
    request.log.error(err);
    return reply.code(500).send({ success: false, error: '아티스트 삭제 중 오류가 발생했습니다.' });
  }
}
