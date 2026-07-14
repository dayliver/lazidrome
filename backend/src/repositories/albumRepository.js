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
  setPrimaryAlbumForTrack(trackId, albumId);
}

/** 트랙을 해당 앨범에만 primary로 연결 (다른 앨범 링크는 제거) */
export function setPrimaryAlbumForTrack(trackId, albumId, opts = {}) {
  const trackNumber = opts.trackNumber ?? null;
  const discNumber = opts.discNumber ?? null;

  db.prepare('DELETE FROM album_tracks WHERE track_id = ? AND album_id != ?').run(trackId, albumId);

  const existing = db
    .prepare('SELECT id FROM album_tracks WHERE track_id = ? AND album_id = ?')
    .get(trackId, albumId);

  if (existing) {
    db.prepare(`
      UPDATE album_tracks
      SET is_primary = 1,
          track_number = COALESCE(?, track_number),
          disc_number = COALESCE(?, disc_number)
      WHERE id = ?
    `).run(trackNumber, discNumber, existing.id);
    return;
  }

  db.prepare(`
    INSERT INTO album_tracks (id, album_id, track_id, is_primary, disc_number, track_number)
    VALUES (?, ?, ?, 1, ?, ?)
  `).run(ulid(), albumId, trackId, discNumber ?? 1, trackNumber);
}

/**
 * 스캐너와 동일: 앨범명 + 아티스트 집합으로 기존 앨범을 찾거나 새로 만든다.
 * @param {string[]} artistIds
 */
export function findOrCreateAlbumByNameAndArtists(albumName, artistIds, year) {
  const safeAlbumName = (albumName && String(albumName).trim()) || 'Unknown Album';
  const ids = [...new Set((artistIds || []).filter(Boolean))];
  const sortedArtistKey = [...ids].sort().join(',');

  const candidateAlbums = db.prepare('SELECT id FROM albums WHERE name = ?').all(safeAlbumName);
  for (const row of candidateAlbums) {
    const existingArtists = db
      .prepare('SELECT artist_id FROM album_artists WHERE album_id = ?')
      .all(row.id)
      .map((a) => a.artist_id);
    if ([...existingArtists].sort().join(',') === sortedArtistKey) {
      return row.id;
    }
  }

  const id = ulid();
  db.prepare('INSERT INTO albums (id, name, year) VALUES (?, ?, ?)').run(id, safeAlbumName, year ?? null);
  if (ids.length) {
    const insertAlbumArtist = db.prepare(
      'INSERT INTO album_artists (album_id, artist_id) VALUES (?, ?)',
    );
    for (const aId of ids) {
      insertAlbumArtist.run(id, aId);
    }
  }
  return id;
}

export function updateAlbumCoverType(albumId, ext) {
  db.prepare('UPDATE albums SET cover_type = ? WHERE id = ?').run(ext, albumId);
}

export function findOrCreateArtist(artist) {
  const name = String(artist?.name ?? '').trim();
  if (artist?.id) {
    const byId = db.prepare('SELECT id FROM artists WHERE id = ?').get(artist.id);
    if (byId) return byId.id;
  }
  if (!name) {
    const err = new Error('Artist name is required');
    err.statusCode = 400;
    throw err;
  }
  const existing = db
    .prepare('SELECT id FROM artists WHERE name = ? COLLATE NOCASE')
    .get(name);
  if (existing) return existing.id;
  const id = ulid();
  try {
    db.prepare('INSERT INTO artists (id, name) VALUES (?, ?)').run(id, name);
    return id;
  } catch (err) {
    // UNIQUE 레이스: 다시 조회
    const again = db
      .prepare('SELECT id FROM artists WHERE name = ? COLLATE NOCASE')
      .get(name);
    if (again) return again.id;
    throw err;
  }
}

export function findAllAlbums() {
  return db
    .prepare(`
    ${ALBUM_LIST_SELECT}
    ${ALBUM_LIST_FROM}
    GROUP BY a.id
    ORDER BY a.year DESC, a.name ASC
  `)
    .all();
}

function albumSearchClause(q) {
  const term = String(q ?? '').trim();
  if (!term) return { sql: '', params: [] };
  const like = `%${term}%`;
  return {
    sql: `WHERE (
      a.name LIKE ?
      OR EXISTS (
        SELECT 1 FROM album_artists aa
        JOIN artists ar ON aa.artist_id = ar.id
        WHERE aa.album_id = a.id AND ar.name LIKE ?
      )
    )`,
    params: [like, like],
  };
}

const ALBUM_LIST_FROM = `
  FROM albums a
  LEFT JOIN album_tracks at ON a.id = at.album_id
  LEFT JOIN track_metadata t ON at.track_id = t.id
  LEFT JOIN track_filedata f ON t.file_id = f.id
`;

const ALBUM_LIST_SELECT = `
  SELECT
    a.id, a.name, a.description, a.year, a.cover_type, a.tags,
    (SELECT GROUP_CONCAT(ar.name, ', ') FROM album_artists aa JOIN artists ar ON aa.artist_id = ar.id WHERE aa.album_id = a.id) as displayArtist,
    COUNT(DISTINCT t.id) as trackCount,
    SUM(f.duration) as totalDuration
`;

export function countAlbums({ q } = {}) {
  const search = albumSearchClause(q);
  const row = db
    .prepare(`SELECT COUNT(DISTINCT a.id) AS n ${ALBUM_LIST_FROM} ${search.sql}`)
    .get(...search.params);
  return Number(row?.n) || 0;
}

export function findAlbumsPage(offset, limit, { q } = {}) {
  const search = albumSearchClause(q);
  return db
    .prepare(`
    ${ALBUM_LIST_SELECT}
    ${ALBUM_LIST_FROM}
    ${search.sql}
    GROUP BY a.id
    ORDER BY a.year DESC, a.name ASC
    LIMIT ? OFFSET ?
  `)
    .all(...search.params, limit, offset);
}

export function findAlbumDetailWithTracks(id) {
  const album = db.prepare(`
    SELECT 
      a.id, a.name, a.description, a.year, a.cover_type, a.tags,
      (SELECT GROUP_CONCAT(ar.name, ', ') FROM album_artists aa JOIN artists ar ON aa.artist_id = ar.id WHERE aa.album_id = a.id) as displayArtist,
      (SELECT SUM(f.duration) FROM album_tracks at JOIN track_metadata t ON at.track_id = t.id JOIN track_filedata f ON t.file_id = f.id WHERE at.album_id = a.id) as totalDuration
    FROM albums a WHERE a.id = ?
  `).get(id);

  if (!album) return null;

  const tracks = db.prepare(`
    SELECT 
      t.id, t.title, t.rating, t.starred, t.play_count, f.duration, at.track_number, at.disc_number,
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

  const artists = db.prepare(`
    SELECT a.id, a.name, a.cover_type, a.tags,
      COUNT(DISTINCT ta.track_id) as trackCount,
      ROUND(AVG(NULLIF(t.rating, 0)), 1) as avgRating
    FROM album_artists aa
    JOIN artists a ON aa.artist_id = a.id
    LEFT JOIN track_artists ta ON a.id = ta.artist_id
    LEFT JOIN track_metadata t ON ta.track_id = t.id
    WHERE aa.album_id = ?
    GROUP BY a.id
    ORDER BY a.name COLLATE NOCASE ASC
  `).all(id);

  return { ...album, tracks, artists };
}

export function findAlbumForEnrich(id) {
  const album = db.prepare(`
    SELECT a.id, a.name, a.description, a.year, a.mbid, a.cover_type, a.tags,
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

  return { ...album, tracks, albumArtists, trackCount: tracks.length };
}

export function countAlbumTracks(id) {
  return Number(
    db.prepare('SELECT COUNT(*) AS c FROM album_tracks WHERE album_id = ?').get(id)?.c,
  ) || 0;
}

export function deleteAlbumById(id) {
  return db.prepare('DELETE FROM albums WHERE id = ?').run(id);
}

export function updateAlbumMeta(id, { title, year, mbid, tags, description }) {
  const cur = db.prepare('SELECT name, year, mbid, tags, description FROM albums WHERE id = ?').get(id);
  if (!cur) return;
  const name = title !== undefined ? title : cur.name;
  const y = year !== undefined ? year : cur.year;
  const m = mbid !== undefined ? (mbid || null) : cur.mbid;
  const tagsStr =
    tags !== undefined ? (Array.isArray(tags) ? JSON.stringify(tags) : null) : cur.tags;
  const desc = description !== undefined ? description : cur.description;
  db.prepare(
    `UPDATE albums SET name = ?, year = ?, mbid = ?, tags = ?, description = ? WHERE id = ?`
  ).run(name, y ?? null, m ?? null, tagsStr, desc ?? null, id);
}

export function replaceAlbumArtists(albumId, artists) {
  db.prepare('DELETE FROM album_artists WHERE album_id = ?').run(albumId);
  const insertStmt = db.prepare('INSERT INTO album_artists (album_id, artist_id) VALUES (?, ?)');
  for (const a of artists) {
    insertStmt.run(albumId, a.artistId);
  }
}

export function replaceAlbumTracks(albumId, tracks) {
  const valid = (tracks || [])
    .map((t) => (t ? { ...t, track_id: t.track_id || t.id } : null))
    .filter((t) => t && t.track_id);
  if (!valid.length) return;

  // 이 앨범에만 있던 링크를 비운 뒤, 목록의 각 트랙을 이 앨범으로 단일 소속 이동
  db.prepare('DELETE FROM album_tracks WHERE album_id = ?').run(albumId);
  for (const t of valid) {
    setPrimaryAlbumForTrack(t.track_id, albumId, {
      trackNumber: t.track_number || null,
      discNumber: t.disc_number || null,
    });
  }
}

export function findBasicAlbumById(id) {
  return db.prepare('SELECT id, name, year, cover_type, mbid, tags, description FROM albums WHERE id = ?').get(id);
}