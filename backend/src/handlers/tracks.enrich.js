import { findTrackForEnrich } from '../repositories/trackRepository.js';
import { lastfmService } from '../services/lastfmService.js';

export async function enrichTrackHandler(request, reply) {
  const { id } = request.params;
  const { mode = 'preview', title: customTitle, artist: customArtist } = request.query;

  try {
    const track = findTrackForEnrich(id);
    if (!track) return reply.code(404).send({ error: 'Track not found' });

    track.artists = JSON.parse(track.artists_json || '[]');
    delete track.artists_json;

    const searchTitle = customTitle || track.title;
    const searchArtist = customArtist || track.artists[0]?.name || '';

    const info = await lastfmService.getTrackInfo(searchArtist, searchTitle);

    if (!info) {
      if (mode === 'preview') return { success: true, mode, local: track, external: null };
      return reply.code(404).send({ error: 'Last.fm에서 정보를 찾을 수 없습니다.' });
    }

    return { success: true, mode, local: track, external: info };
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: '트랙 강화 중 서버 오류 발생' });
  }
}