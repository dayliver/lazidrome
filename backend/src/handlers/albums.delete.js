import { deleteAlbum } from '../services/albumService.js';

/**
 * DELETE /api/albums/:id
 * 수록곡이 없는 앨범만 삭제. 곡이 있으면 409.
 */
export async function deleteAlbumHandler(request, reply) {
  const { id } = request.params;
  try {
    const data = deleteAlbum(id);
    return { success: true, data };
  } catch (err) {
    const code = Number(err?.statusCode) || 500;
    if (err?.message === 'HAS_TRACKS') {
      return reply.code(409).send({
        success: false,
        error: 'HAS_TRACKS',
        trackCount: Number(err.trackCount) || 0,
      });
    }
    if (code === 404) {
      return reply.code(404).send({ success: false, error: 'Not found' });
    }
    request.log.error(err);
    return reply.code(500).send({ success: false, error: '앨범 삭제 중 오류가 발생했습니다.' });
  }
}
