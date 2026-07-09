import {
  findArtistsWithTag,
  findAlbumsWithTag,
  findTracksWithTag
} from '../repositories/tagRepository.js';
import { findTopTracksForArtistIds } from '../repositories/artistRepository.js';
import { formatAlbumTags } from '../services/albumService.js';

export async function getTagDetailHandler(request, reply) {
  const tagName = request.query.name;
  if (!tagName || typeof tagName !== 'string') {
    return reply.code(400).send({ error: '쿼리 파라미터 name이 필요합니다.' });
  }

  try {
    const rawArtists = findArtistsWithTag(tagName);
    const artistIds = rawArtists.map((a) => a.id);
    const topTracksData = findTopTracksForArtistIds(artistIds);
    const topTracksMap = {};
    for (const row of topTracksData) {
      if (!topTracksMap[row.artist_id]) topTracksMap[row.artist_id] = [];
      topTracksMap[row.artist_id].push({ id: row.track_id, title: row.title });
    }

    const artists = rawArtists.map((artist) => {
      let parsedTags = [];
      if (artist.tags) {
        try {
          parsedTags = JSON.parse(artist.tags).slice(0, 3);
        } catch {
          parsedTags = [];
        }
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

    const rawAlbums = findAlbumsWithTag(tagName);
    const albums = rawAlbums.map((a) => formatAlbumTags({ ...a }));

    const rawTracks = findTracksWithTag(tagName);
    const tracks = rawTracks.map((t) => ({
      ...t,
      tags: JSON.parse(t.tags || '[]')
    }));

    return {
      success: true,
      data: { tagName, artists, albums, tracks }
    };
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: '태그 상세 조회 중 서버 오류가 발생했습니다.' });
  }
}
