import { findAlbumForEnrich } from '../repositories/albumRepository.js';
import { lastfmService } from '../services/lastfmService.js';
import { formatAlbumTags } from '../services/albumService.js'; // 💡 1. 헬퍼 함수 임포트!

export async function enrichAlbumHandler(request, reply) {
  const { id } = request.params;
  const mode = request.query.mode || 'preview';

  try {
    let localData = findAlbumForEnrich(id);
    if (!localData) return reply.code(404).send({ error: 'Album not found' });

    // 💡 2. 프론트로 보내기 전(또는 비교 전)에 문자열 '[]'을 진짜 배열 []로 파싱합니다!
    localData = formatAlbumTags(localData);

    const cleanAlbumName = localData.name.replace(/\s*\([^)]*\)/g, '').trim();
    const searchArtistName = localData.artistName ? localData.artistName.split(',')[0] : '';
    
    const info = await lastfmService.getAlbumInfo(searchArtistName, cleanAlbumName);

    if (!info) {
      if (mode === 'preview') return { success: true, mode, local: localData, external: null };
      return reply.code(404).send({ error: 'Last.fm에서 정보를 찾을 수 없습니다.' });
    }

    if (mode === 'preview') return { success: true, mode, local: localData, external: info };

    const { updateAlbumMeta } = await import('../repositories/albumRepository.js');
    const releaseYear = info.releaseDate ? parseInt(info.releaseDate.match(/\d{4}/)?.[0], 10) : null;
    const finalYear = (mode === 'fill' && localData.year) ? localData.year : (releaseYear || localData.year);
    
    // 💡 저장할 때는 다시 문자열로(DB 스키마) 넘어갑니다.
    updateAlbumMeta(id, { title: localData.name, year: finalYear, mbid: info.mbid || localData.mbid, tags: localData.tags });

    return { success: true, mode, data: info };
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: '앨범 강화 중 서버 오류 발생' });
  }
}