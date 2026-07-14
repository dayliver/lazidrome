import {
  countArtists,
  findAllArtists,
  findArtistsPage,
  findTopTracksForArtistIds,
  parseArtistSort,
} from '../repositories/artistRepository.js';
import { parsePageQuery, parseSearchQuery } from '../lib/pageQuery.js';

function parseArtistTags(raw) {
  if (!raw?.tags) return [];
  try {
    return JSON.parse(raw.tags).slice(0, 3);
  } catch {
    return [];
  }
}

function attachTopTracks(artists, topTracksData) {
  const topTracksMap = {};
  for (const row of topTracksData) {
    if (!topTracksMap[row.artist_id]) topTracksMap[row.artist_id] = [];
    topTracksMap[row.artist_id].push({ id: row.track_id, title: row.title });
  }

  return artists.map((artist) => ({
    id: artist.id,
    name: artist.name,
    cover_type: artist.cover_type,
    trackCount: artist.trackCount,
    listenSec: Number(artist.listenSec) || 0,
    avgRating: artist.avgRating || 0,
    topTags: parseArtistTags(artist),
    topTracks: topTracksMap[artist.id] || [],
  }));
}

export async function getArtistsHandler(request, reply) {
  try {
    const page = parsePageQuery(request.query ?? {});
    const q = parseSearchQuery(request.query ?? {});
    const sort = parseArtistSort(request.query?.sort);

    if (page) {
      const { offset, limit } = page;
      const total = countArtists({ q });
      const rows = findArtistsPage(offset, limit, { q, sort });
      const artistIds = rows.map((a) => a.id);
      const topTracksData = findTopTracksForArtistIds(artistIds);
      const items = attachTopTracks(rows, topTracksData);
      return {
        items,
        total,
        offset,
        limit,
        sort,
        hasMore: offset + items.length < total,
      };
    }

    const artists = findAllArtists();
    const topTracksData = findTopTracksForArtistIds(null);
    return attachTopTracks(artists, topTracksData);
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: '아티스트 목록 조회 중 오류 발생' });
  }
}
