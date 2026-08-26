import { getDB } from '../db.js';

const db = getDB();

/** @typedef {'listenDesc'|'tracksDesc'|'nameAsc'|'addedAsc'|'addedDesc'} ArtistSort */

const ARTIST_SORTS = new Set(['listenDesc', 'tracksDesc', 'nameAsc', 'addedAsc', 'addedDesc']);

export function parseArtistSort(raw) {
  const s = String(raw || '').trim();
  return ARTIST_SORTS.has(s) ? s : 'listenDesc';
}

function artistOrderSql(sort) {
  switch (sort) {
    case 'tracksDesc':
      return 'trackCount DESC, a.name COLLATE NOCASE ASC';
    case 'nameAsc':
      return 'a.name COLLATE NOCASE ASC';
    case 'addedAsc':
      return 'a.id ASC';
    case 'addedDesc':
      return 'a.id DESC';
    case 'listenDesc':
    default:
      return 'listenSec DESC, trackCount DESC, a.name COLLATE NOCASE ASC';
  }
}

const ARTIST_LIST_SELECT = `
    SELECT a.id, a.name, a.cover_type, a.tags,
      COUNT(DISTINCT ta.track_id) as trackCount,
      ROUND(AVG(NULLIF(t.rating, 0)), 1) as avgRating,
      COALESCE((
        SELECT SUM(COALESCE(h.listened_sec, 0))
        FROM track_artists tax
        JOIN play_history h ON h.track_id = tax.track_id
        WHERE tax.artist_id = a.id
      ), 0) as listenSec
`;

const ARTIST_LIST_FROM = `
    FROM artists a
    LEFT JOIN track_artists ta ON a.id = ta.artist_id
    LEFT JOIN track_metadata t ON ta.track_id = t.id
`;

export function findAllArtists() {
  return db
    .prepare(`
    ${ARTIST_LIST_SELECT}
    ${ARTIST_LIST_FROM}
    GROUP BY a.id
    ORDER BY ${artistOrderSql('listenDesc')}
  `)
    .all();
}

function artistSearchClause(q) {
  const term = String(q ?? '').trim();
  if (!term) return { sql: '', params: [] };
  return { sql: 'WHERE a.name LIKE ?', params: [`%${term}%`] };
}

export function countArtists({ q } = {}) {
  const search = artistSearchClause(q);
  const row = db
    .prepare(`SELECT COUNT(*) AS n FROM artists a ${search.sql}`)
    .get(...search.params);
  return Number(row?.n) || 0;
}

export function findArtistsPage(offset, limit, { q, sort } = {}) {
  const search = artistSearchClause(q);
  const order = artistOrderSql(parseArtistSort(sort));
  return db
    .prepare(`
    ${ARTIST_LIST_SELECT}
    ${ARTIST_LIST_FROM}
    ${search.sql}
    GROUP BY a.id
    ORDER BY ${order}
    LIMIT ? OFFSET ?
  `)
    .all(...search.params, limit, offset);
}

export function findTopTracksForArtists() {
  return findTopTracksForArtistIds(null);
}

/** @param {string[]|null} artistIds null이면 전체(레거시) */
export function findTopTracksForArtistIds(artistIds) {
  if (Array.isArray(artistIds) && artistIds.length === 0) return [];
  const idFilter =
    Array.isArray(artistIds) && artistIds.length
      ? `WHERE ta.artist_id IN (${artistIds.map(() => '?').join(',')})`
      : '';
  const params = Array.isArray(artistIds) && artistIds.length ? artistIds : [];
  return db
    .prepare(`
    SELECT artist_id, track_id, title
    FROM (
      SELECT ta.artist_id, t.id as track_id, t.title,
        ROW_NUMBER() OVER(PARTITION BY ta.artist_id ORDER BY t.play_count DESC, t.rating DESC) as rn
      FROM track_artists ta
      JOIN track_metadata t ON ta.track_id = t.id
      ${idFilter}
    )
    WHERE rn <= 3
  `)
    .all(...params);
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
    SELECT t.id, t.title, t.rating, t.starred, t.play_count, t.tags,
      COALESCE(t.volume_pct, 100) AS volume_pct,
      ta.role_mask, f.duration, 
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
  return db.prepare('SELECT id, name, tags, mbid, cover_type FROM artists WHERE id = ?').get(id);
}

export function countArtistTracks(id) {
  return Number(
    db.prepare('SELECT COUNT(*) AS c FROM track_artists WHERE artist_id = ?').get(id)?.c,
  ) || 0;
}

export function deleteArtistById(id) {
  return db.prepare('DELETE FROM artists WHERE id = ?').run(id);
}

export function findArtistBio(id, lang = 'en') {
  return db.prepare('SELECT biography FROM artist_biographies WHERE artist_id = ? AND language = ?').get(id, lang);
}

export function updateArtistMeta(id, { name, tags, mbid }) {
  const fields = [];
  const values = [];

  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (trimmed) {
      const clash = db
        .prepare('SELECT id FROM artists WHERE name = ? COLLATE NOCASE AND id != ?')
        .get(trimmed, id);
      if (clash) {
        const err = new Error('An artist with this name already exists');
        err.statusCode = 409;
        throw err;
      }
      fields.push('name = ?');
      values.push(trimmed);
    }
  }
  if (tags !== undefined) {
    fields.push('tags = ?');
    values.push(tags ? JSON.stringify(tags) : null);
  }
  if (mbid !== undefined) {
    fields.push('mbid = ?');
    values.push(mbid || null);
  }

  if (!fields.length) return;

  values.push(id);
  db.prepare(`UPDATE artists SET ${fields.join(', ')} WHERE id = ?`).run(...values);
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