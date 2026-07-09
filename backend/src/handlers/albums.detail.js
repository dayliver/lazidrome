import { findAlbumDetailWithTracks } from '../repositories/albumRepository.js';
import { findTopTracksForArtistIds } from '../repositories/artistRepository.js';
import { formatAlbumTags } from '../services/albumService.js';

function parseArtistTags(raw) {
  if (!raw?.tags) return [];
  try {
    return JSON.parse(raw.tags).slice(0, 3);
  } catch {
    return [];
  }
}

export async function getAlbumDetailHandler(request, reply) {
  const { id } = request.params;
  try {
    const result = findAlbumDetailWithTracks(id);
    if (!result) return reply.code(404).send({ error: 'Album not found' });

    const formatted = formatAlbumTags(result);
    const artistRows = result.artists || [];
    const topTracksData = findTopTracksForArtistIds(artistRows.map((a) => a.id));
    const topTracksMap = {};
    for (const row of topTracksData) {
      if (!topTracksMap[row.artist_id]) topTracksMap[row.artist_id] = [];
      topTracksMap[row.artist_id].push({ id: row.track_id, title: row.title });
    }

    formatted.artists = artistRows.map((artist) => ({
      id: artist.id,
      name: artist.name,
      cover_type: artist.cover_type,
      trackCount: artist.trackCount,
      avgRating: artist.avgRating || 0,
      topTags: parseArtistTags(artist),
      topTracks: topTracksMap[artist.id] || [],
    }));

    return formatted;
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: '앨범 상세 정보 조회 중 오류 발생' });
  }
}
