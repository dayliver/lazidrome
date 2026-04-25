import { getDB } from '../db.js';

const db = getDB();

export function findAllPlaylists() {
  return db.prepare('SELECT id, name, description, cover_type, type, rules, created_at FROM playlists ORDER BY created_at DESC').all();
}

export function findPlaylistById(id) {
  return db.prepare('SELECT * FROM playlists WHERE id = ?').get(id);
}

export function deletePlaylistById(id) {
  db.prepare('DELETE FROM playlists WHERE id = ?').run(id);
}

export function findManualPlaylistTracks(id) {
  return db.prepare(`
    SELECT pt.id as playlist_track_id, pt.position,
      t.id, t.title, t.rating, t.play_count, t.tags, f.duration, 
      alb.id as albumId, alb.name as albumName, alb.cover_type as albumCoverType,
      (SELECT json_group_array(json_object('id', a.id, 'name', a.name))
       FROM track_artists ta JOIN artists a ON ta.artist_id = a.id WHERE ta.track_id = t.id) as artists_json
    FROM playlist_tracks pt
    JOIN track_metadata t ON pt.track_id = t.id
    JOIN track_filedata f ON t.file_id = f.id
    LEFT JOIN album_tracks at ON t.id = at.track_id AND at.is_primary = 1
    LEFT JOIN albums alb ON at.album_id = alb.id
    WHERE pt.playlist_id = ?
    ORDER BY pt.position ASC
  `).all(id);
}

// 💡 스마트 믹스용 동적 쿼리 실행기
export function executeSmartMixQuery(sql, params) {
  return db.prepare(sql).all(...params);
}

export function deletePlaylistTrack(playlistTrackId, playlistId) {
  db.prepare('DELETE FROM playlist_tracks WHERE id = ? AND playlist_id = ?').run(playlistTrackId, playlistId);
}