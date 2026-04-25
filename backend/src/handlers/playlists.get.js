import { findAllPlaylists, findPlaylistById, findManualPlaylistTracks, executeSmartMixQuery } from '../repositories/playlistRepository.js';
import { buildMixQuery } from '../services/playlistService.js';

export async function getPlaylistsHandler(request, reply) {
  try {
    const playlists = findAllPlaylists();
    return playlists.map(p => ({ ...p, rules: p.type === 'mix' && p.rules ? JSON.parse(p.rules) : null }));
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: '목록 조회 실패' });
  }
}

export async function getPlaylistDetailHandler(request, reply) {
  try {
    const { id } = request.params;
    const playlist = findPlaylistById(id);
    if (!playlist) return reply.code(404).send({ error: 'Not found' });
    if (playlist.rules) playlist.rules = JSON.parse(playlist.rules);

    let tracks = [];
    if (playlist.type === 'list') {
      tracks = findManualPlaylistTracks(id);
    } else if (playlist.type === 'mix') {
      const { sql, params } = buildMixQuery(playlist.rules ? JSON.stringify(playlist.rules) : null);
      tracks = executeSmartMixQuery(sql, params);
    }

    tracks = tracks.map(t => {
      t.artist = JSON.parse(t.artists_json || '[]').map(a => a.name).join(', ');
      delete t.artists_json;
      return t;
    });

    return { ...playlist, tracks };
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: '상세 조회 실패' });
  }
}