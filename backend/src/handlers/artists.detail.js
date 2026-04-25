import { findArtistDetail, findArtistTracks } from '../repositories/artistRepository.js';
import { formatArtistTags } from '../services/artistService.js';

export async function getArtistDetailHandler(request, reply) {
  const { id } = request.params;
  try {
    const artist = findArtistDetail(id);
    if (!artist) return reply.code(404).send({ error: 'Artist not found' });

    const tracks = findArtistTracks(id);
    const formattedArtist = formatArtistTags(artist); // 💡 태그 배열화 적용!

    return {
      ...formattedArtist,
      aliases: JSON.parse(artist.aliases || '{}'),
      tracks
    };
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: '아티스트 상세 정보 조회 중 오류 발생' });
  }
}