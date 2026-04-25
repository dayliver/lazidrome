import { findArtistForEnrich, findArtistBio, updateArtistMeta, upsertArtistBio } from '../repositories/artistRepository.js';
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

    artist = formatArtistTags(artist); // 💡 문자열 '[ ... ]' 방지

    const searchTarget = customSearchName || artist.name;
    const info = await lastfmService.getArtistInfo(searchTarget);
    const localBio = findArtistBio(id, 'en');
    
    if (!info) {
      if (mode === 'preview') return { success: true, mode, local: { ...artist, bio: localBio?.biography }, external: null };
      return reply.code(404).send({ error: 'Last.fm에서 정보를 찾을 수 없습니다.' });
    }

    if (mode === 'preview') {
      return { success: true, mode, local: { ...artist, bio: localBio?.biography }, external: info };
    }

    // 💡 저장 모드 (Force/Fill)
    const db = getDB();
    db.transaction(() => {
      // DB에 들어갈 때는 문자열 변환 전인 기존 tags 텍스트를 사용하거나 배열을 넘깁니다. (updateArtistMeta가 알아서 stringify 처리)
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