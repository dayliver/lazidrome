import { findAlbumDetailWithTracks } from '../repositories/albumRepository.js';
import { formatAlbumTags } from '../services/albumService.js'; // 💡 1. 임포트 추가

export async function getAlbumDetailHandler(request, reply) {
  const { id } = request.params;
  try {
    let result = findAlbumDetailWithTracks(id);
    if (!result) return reply.code(404).send({ error: 'Album not found' });
    
    // 💡 2. 반환하기 직전에 파싱 적용
    return formatAlbumTags(result); 
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: '앨범 상세 정보 조회 중 오류 발생' });
  }
}