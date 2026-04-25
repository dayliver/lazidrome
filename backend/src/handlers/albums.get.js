import { findAllAlbums } from '../repositories/albumRepository.js';
import { formatAlbumTags } from '../services/albumService.js';

export async function getAlbumsHandler(request, reply) {
  try {
    const albums = findAllAlbums();
    return albums.map(a => formatAlbumTags(a));
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: '앨범 목록 조회 중 서버 오류 발생' });
  }
}