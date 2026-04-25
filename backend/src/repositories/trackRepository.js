import { getDB } from '../db.js';

const db = getDB();

export function findAllTracks() {
  return db.prepare(`
    SELECT 
      t.id, t.title, t.rating, t.starred, t.year, t.tags, t.play_count, t.last_played,
      t.custom_cover_type, f.duration, f.format, f.bitrate,
      alb.id as albumId, alb.name as albumName, alb.cover_type as albumCoverType, 
      GROUP_CONCAT(a.name, ', ') as artist
    FROM track_metadata t
    JOIN track_filedata f ON t.file_id = f.id
    LEFT JOIN album_tracks at ON t.id = at.track_id AND at.is_primary = 1
    LEFT JOIN albums alb ON at.album_id = alb.id
    LEFT JOIN track_artists ta ON t.id = ta.track_id
    LEFT JOIN artists a ON ta.artist_id = a.id
    GROUP BY t.id
    ORDER BY f.scanned_at DESC
  `).all();
}

export function findTrackById(id) {
  return db.prepare(`
    SELECT t.id, t.title, t.rating, t.starred, t.tags, t.genre,
      f.duration, alb.id as albumId, alb.name as albumName, alb.cover_type as albumCoverType,
      (SELECT json_group_array(json_object('id', a.id, 'name', a.name))
        FROM track_artists ta JOIN artists a ON ta.artist_id = a.id WHERE ta.track_id = t.id) as artists_json
    FROM track_metadata t
    JOIN track_filedata f ON t.file_id = f.id
    LEFT JOIN album_tracks at ON t.id = at.track_id AND at.is_primary = 1
    LEFT JOIN albums alb ON at.album_id = alb.id
    WHERE t.id = ?
  `).get(id);
}

export function findTrackForEnrich(id) {
  return db.prepare(`
    SELECT t.id, t.title, t.tags, alb.year as year, alb.id as currentAlbumId,
      alb.name as albumName, alb.cover_type as albumCoverType,
      (SELECT json_group_array(json_object('id', a.id, 'name', a.name, 'role_mask', ta.role_mask))
        FROM track_artists ta JOIN artists a ON ta.artist_id = a.id WHERE ta.track_id = t.id) as artists_json
    FROM track_metadata t
    LEFT JOIN album_tracks at ON t.id = at.track_id AND at.is_primary = 1
    LEFT JOIN albums alb ON at.album_id = alb.id
    WHERE t.id = ?
  `).get(id);
}

export function updateTrackRating(id, { rating, tags, starred }) {
  const result = db.prepare(`
    UPDATE track_metadata 
    SET rating = COALESCE(?, rating), 
        tags = COALESCE(?, tags),
        starred = COALESCE(?, starred)
    WHERE id = ?
  `).run(rating, tags ? JSON.stringify(tags) : null, starred, id);

  return result.changes;
}

export function updateTrackMeta(id, { title, genre, tags }) {
  db.prepare(`
    UPDATE track_metadata 
    SET title = COALESCE(?, title),
        genre = COALESCE(?, genre),
        tags = COALESCE(?, tags)
    WHERE id = ?
  `).run(title, genre || null, tags ? JSON.stringify(tags) : null, id);
}

export function replaceTrackArtists(trackId, artists) {
  db.prepare('DELETE FROM track_artists WHERE track_id = ?').run(trackId);
  for (const a of artists) {
    if (a.artistId) {
      db.prepare('INSERT INTO track_artists (track_id, artist_id, role_mask) VALUES (?, ?, ?)')
        .run(trackId, a.artistId, a.role_mask || 1);
    }
  }
}