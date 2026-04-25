import { findAllArtists, findTopTracksForArtists } from '../repositories/artistRepository.js';

export async function getArtistsHandler(request, reply) {
  try {
    const artists = findAllArtists();
    const topTracksData = findTopTracksForArtists();

    const topTracksMap = {};
    for (const row of topTracksData) {
      if (!topTracksMap[row.artist_id]) topTracksMap[row.artist_id] = [];
      topTracksMap[row.artist_id].push({ id: row.track_id, title: row.title });
    }

    return artists.map(artist => {
      let parsedTags = [];
      if (artist.tags) {
        try { parsedTags = JSON.parse(artist.tags).slice(0, 3); } catch (e) {}
      }
      return {
        id: artist.id,
        name: artist.name,
        cover_type: artist.cover_type,
        trackCount: artist.trackCount,
        avgRating: artist.avgRating || 0,
        topTags: parsedTags, 
        topTracks: topTracksMap[artist.id] || []
      };
    });
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: '아티스트 목록 조회 중 오류 발생' });
  }
}