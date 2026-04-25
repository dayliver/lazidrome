import { getDB } from '../db.js';

const db = getDB();

export function findAllArtists() {
  return db.prepare(`
    SELECT a.id, a.name, a.cover_type, a.tags,
      COUNT(DISTINCT ta.track_id) as trackCount,
      ROUND(AVG(NULLIF(t.rating, 0)), 1) as avgRating
    FROM artists a
    LEFT JOIN track_artists ta ON a.id = ta.artist_id
    LEFT JOIN track_metadata t ON ta.track_id = t.id
    GROUP BY a.id
    ORDER BY a.name COLLATE NOCASE ASC
  `).all();
}

export function findTopTracksForArtists() {
  return db.prepare(`
    SELECT artist_id, track_id, title
    FROM (
      SELECT ta.artist_id, t.id as track_id, t.title, 
        ROW_NUMBER() OVER(PARTITION BY ta.artist_id ORDER BY t.play_count DESC, t.rating DESC) as rn
      FROM track_artists ta
      JOIN track_metadata t ON ta.track_id = t.id
    )
    WHERE rn <= 3
  `).all();
}

export function findArtistDetail(id) {
  return db.prepare(`
    SELECT a.*, ab.biography as bio
    FROM artists a
    LEFT JOIN artist_biographies ab ON a.id = ab.artist_id AND ab.language = 'en'
    WHERE a.id = ?
  `).get(id);
}

export function findArtistTracks(id) {
  return db.prepare(`
    SELECT t.id, t.title, t.rating, t.play_count, ta.role_mask, f.duration, 
      alb.id as albumId, alb.name as albumName, alb.cover_type as albumCoverType 
    FROM track_metadata t
    JOIN track_artists ta ON t.id = ta.track_id
    JOIN track_filedata f ON t.file_id = f.id
    LEFT JOIN album_tracks at ON t.id = at.track_id AND at.is_primary = 1
    LEFT JOIN albums alb ON at.album_id = alb.id
    WHERE ta.artist_id = ?
    ORDER BY t.play_count DESC, t.rating DESC
  `).all(id);
}

export function findArtistForEnrich(id) {
  return db.prepare('SELECT id, name, tags, mbid FROM artists WHERE id = ?').get(id);
}

export function findArtistBio(id, lang = 'en') {
  return db.prepare('SELECT biography FROM artist_biographies WHERE artist_id = ? AND language = ?').get(id, lang);
}

export function updateArtistMeta(id, { name, tags, mbid }) {
  db.prepare(`UPDATE artists SET name = COALESCE(?, name), tags = ?, mbid = ? WHERE id = ?`)
    .run(name, tags ? JSON.stringify(tags) : null, mbid || null, id);
}

export function upsertArtistBio(id, lang, biography) {
  db.prepare(`
    INSERT INTO artist_biographies (artist_id, language, biography) 
    VALUES (?, ?, ?) 
    ON CONFLICT(artist_id, language) DO UPDATE SET biography = excluded.biography
  `).run(id, lang, biography);
}

export function deleteArtistBio(id, lang) {
  db.prepare(`DELETE FROM artist_biographies WHERE artist_id = ? AND language = ?`).run(id, lang);
}

export function updateArtistCoverType(id, ext) {
  db.prepare('UPDATE artists SET cover_type = ? WHERE id = ?').run(ext, id);
}

export function findBasicArtistById(id) {
  return db.prepare('SELECT id, name, cover_type, tags, mbid FROM artists WHERE id = ?').get(id);
}