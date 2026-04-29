import { getDB } from '../db.js';

const db = getDB();

export function findAlbumCoverType(id) {
  return db.prepare('SELECT cover_type FROM albums WHERE id = ?').get(id);
}

export function findTrackCoverInfo(id) {
  return db.prepare(`
    SELECT t.custom_cover_type, alb.id as album_id, alb.cover_type as album_cover_type
    FROM track_metadata t
    LEFT JOIN album_tracks at ON t.id = at.track_id AND at.is_primary = 1
    LEFT JOIN albums alb ON at.album_id = alb.id
    WHERE t.id = ?
  `).get(id);
}

export function findArtistCoverType(id) {
  return db.prepare('SELECT cover_type FROM artists WHERE id = ?').get(id);
}

export function findPlaylistCoverType(id) {
  return db.prepare('SELECT cover_type FROM playlists WHERE id = ?').get(id);
}

/** 앨범 커버 API가 트랙 커버와 동일한 파일을 가리키도록 할 때 사용 (대표 트랙 1곡) */
export function findRepresentativeTrackIdForAlbum(albumId) {
  return db
    .prepare(
      `
    SELECT t.id
    FROM album_tracks at
    JOIN track_metadata t ON t.id = at.track_id
    WHERE at.album_id = ?
    ORDER BY at.is_primary DESC, COALESCE(at.disc_number, 1), COALESCE(at.track_number, 999999), t.title
    LIMIT 1
  `
    )
    .get(albumId);
}