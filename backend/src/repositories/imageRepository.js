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