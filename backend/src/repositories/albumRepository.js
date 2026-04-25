import { getDB } from '../db.js';
import { ulid } from 'ulid';

const db = getDB();

export function findAlbumById(id) {
  return db.prepare('SELECT id FROM albums WHERE id = ?').get(id);
}

export function findAlbumByName(name) {
  return db.prepare('SELECT id FROM albums WHERE name = ?').get(name);
}

export function createAlbum(name, year) {
  const id = ulid();
  db.prepare('INSERT INTO albums (id, name, year) VALUES (?, ?, ?)').run(id, name, year);
  return id;
}

export function updateAlbumTrack(trackId, albumId) {
  db.prepare('UPDATE album_tracks SET album_id = ? WHERE track_id = ? AND is_primary = 1')
    .run(albumId, trackId);
}

export function updateAlbumCoverType(albumId, ext) {
  db.prepare('UPDATE albums SET cover_type = ? WHERE id = ?').run(ext, albumId);
}

export function findOrCreateArtist(artist) {
  if (artist.id) return artist.id;
  const existing = db.prepare('SELECT id FROM artists WHERE name = ?').get(artist.name);
  if (existing) return existing.id;
  const id = ulid();
  db.prepare('INSERT INTO artists (id, name) VALUES (?, ?)').run(id, artist.name);
  return id;
}

export function findAllAlbums() {
  return db.prepare(`
    SELECT 
      a.id, a.name, a.year, a.cover_type, a.tags,
      (SELECT GROUP_CONCAT(ar.name, ', ') FROM album_artists aa JOIN artists ar ON aa.artist_id = ar.id WHERE aa.album_id = a.id) as displayArtist,
      COUNT(DISTINCT t.id) as trackCount,
      SUM(f.duration) as totalDuration
    FROM albums a
    LEFT JOIN album_tracks at ON a.id = at.album_id
    LEFT JOIN track_metadata t ON at.track_id = t.id
    LEFT JOIN track_filedata f ON t.file_id = f.id
    GROUP BY a.id
    ORDER BY a.year DESC, a.name ASC
  `).all();
}

export function findAlbumDetailWithTracks(id) {
  const album = db.prepare(`
    SELECT 
      a.id, a.name, a.year, a.cover_type, a.tags,
      (SELECT GROUP_CONCAT(ar.name, ', ') FROM album_artists aa JOIN artists ar ON aa.artist_id = ar.id WHERE aa.album_id = a.id) as displayArtist,
      (SELECT SUM(f.duration) FROM album_tracks at JOIN track_metadata t ON at.track_id = t.id JOIN track_filedata f ON t.file_id = f.id WHERE at.album_id = a.id) as totalDuration
    FROM albums a WHERE a.id = ?
  `).get(id);

  if (!album) return null;

  const tracks = db.prepare(`
    SELECT 
      t.id, t.title, t.rating, t.play_count, f.duration, at.track_number, at.disc_number,
      GROUP_CONCAT(ar.name, ', ') as artist
    FROM track_metadata t
    JOIN album_tracks at ON t.id = at.track_id
    JOIN track_filedata f ON t.file_id = f.id
    LEFT JOIN track_artists ta ON t.id = ta.track_id
    LEFT JOIN artists ar ON ta.artist_id = ar.id
    WHERE at.album_id = ?
    GROUP BY t.id, at.track_number, at.disc_number
    ORDER BY at.disc_number ASC, at.track_number ASC, t.title ASC
  `).all(id);

  return { ...album, tracks };
}

export function findAlbumForEnrich(id) {
  const album = db.prepare(`
    SELECT a.id, a.name, a.year, a.mbid, a.cover_type, a.tags,
      (SELECT GROUP_CONCAT(ar.name, ', ') FROM album_artists aa JOIN artists ar ON aa.artist_id = ar.id WHERE aa.album_id = a.id) as artistName
    FROM albums a WHERE a.id = ?
  `).get(id);

  if (!album) return null;

  const tracks = db.prepare(`
    SELECT at.track_id, at.disc_number, at.track_number, at.is_primary, tm.title,
      (SELECT group_concat(name, ', ') FROM artists JOIN track_artists ON artists.id = artist_id WHERE track_id = tm.id) as artist
    FROM album_tracks at
    JOIN track_metadata tm ON at.track_id = tm.id
    WHERE at.album_id = ?
    ORDER BY at.disc_number, at.track_number
  `).all(id);

  const albumArtists = db.prepare(`
    SELECT ar.id, ar.name FROM album_artists aa JOIN artists ar ON aa.artist_id = ar.id WHERE aa.album_id = ?
  `).all(id);

  return { ...album, tracks, albumArtists };
}

export function updateAlbumMeta(id, { title, year, mbid, tags }) {
  db.prepare(`UPDATE albums SET name = COALESCE(?, name), year = ?, mbid = ?, tags = ? WHERE id = ?`)
    .run(title, year || null, mbid || null, tags ? JSON.stringify(tags) : null, id);
}

export function replaceAlbumArtists(albumId, artists) {
  db.prepare('DELETE FROM album_artists WHERE album_id = ?').run(albumId);
  const insertStmt = db.prepare('INSERT INTO album_artists (album_id, artist_id) VALUES (?, ?)');
  for (const a of artists) {
    insertStmt.run(albumId, a.artistId);
  }
}

export function replaceAlbumTracks(albumId, tracks) {
  db.prepare('DELETE FROM album_tracks WHERE album_id = ?').run(albumId);
  const insertStmt = db.prepare(`
    INSERT INTO album_tracks (id, album_id, track_id, is_primary, disc_number, track_number)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const t of tracks) {
    insertStmt.run(ulid(), albumId, t.track_id, t.is_primary ? 1 : 0, t.disc_number || 1, t.track_number || null);
  }
}

export function findBasicAlbumById(id) {
  return db.prepare('SELECT id, name, year, cover_type, mbid, tags FROM albums WHERE id = ?').get(id);
}