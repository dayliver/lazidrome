import {
  findArtistForEnrich,
  findArtistBio,
  updateArtistMeta,
  upsertArtistBio,
  countArtistTracks,
} from '../repositories/artistRepository.js';
import { lastfmService } from '../services/lastfmService.js';
import { mergeTags, formatArtistTags } from '../services/artistService.js';
import { getDB } from '../db.js';

export async function enrichArtistHandler(request, reply) {
  const { id } = request.params;
  const mode = request.query.mode || 'preview';
  const customSearchName = request.query.title || request.query.artist;

  try {
    let artist = findArtistForEnrich(id);
    if (!artist) return reply.code(404).send({ error: 'Artist not found' });

    artist = formatArtistTags(artist);
    const trackCount = countArtistTracks(id);
    const localBio = findArtistBio(id, 'en');
    const localPayload = { ...artist, bio: localBio?.biography, trackCount };

    const searchTarget = customSearchName || artist.name;
    const info = await lastfmService.getArtistInfo(searchTarget);

    if (!info) {
      if (mode === 'preview') return { success: true, mode, local: localPayload, external: null };
      return reply.code(404).send({ error: 'Last.fm에서 정보를 찾을 수 없습니다.' });
    }

    if (mode === 'preview') {
      return { success: true, mode, local: localPayload, external: info };
    }

    const db = getDB();
    db.transaction(() => {
      const finalTags = mergeTags(artist.tags ? JSON.stringify(artist.tags) : null, info.tags, mode);
      updateArtistMeta(id, { name: artist.name, tags: finalTags, mbid: info.mbid || artist.mbid });

      if (info.bio && (mode === 'force' || mode === 'fill')) {
        upsertArtistBio(id, 'en', info.bio);
      }
    })();

    return { success: true, mode, data: info };
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: '아티스트 강화 중 서버 오류 발생' });
  }
}
