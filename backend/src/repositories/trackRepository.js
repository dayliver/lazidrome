import { getDB } from '../db.js';
import {
  parseTrackListFilters,
  buildTrackListWhere,
  buildTrackListOrder,
} from '../lib/trackListQuery.js';

const db = getDB();

const TRACK_LIST_FROM = `
    FROM track_metadata t
    JOIN track_filedata f ON t.file_id = f.id
    LEFT JOIN album_tracks at ON t.id = at.track_id AND at.is_primary = 1
    LEFT JOIN albums alb ON at.album_id = alb.id
    LEFT JOIN track_artists ta ON t.id = ta.track_id
    LEFT JOIN artists a ON ta.artist_id = a.id`;

const TRACK_LIST_SELECT = `
    SELECT 
      t.id, t.title, t.rating, t.starred,
      COALESCE(t.year, alb.year) AS year, t.tags, t.play_count, t.last_played,
      COALESCE(t.volume_pct, 100) AS volume_pct,
      t.custom_cover_type, f.duration, f.format, f.bitrate, f.scanned_at,
      alb.id as albumId, alb.name as albumName, alb.cover_type as albumCoverType,
      at.track_number, at.disc_number,
      GROUP_CONCAT(a.name, ', ') as artist
    ${TRACK_LIST_FROM}`;

/** 앨범 상세 스코프: 해당 앨범의 disc/track 번호 사용 */
const TRACK_LIST_FROM_ALBUM = `
    FROM track_metadata t
    JOIN track_filedata f ON t.file_id = f.id
    JOIN album_tracks at ON t.id = at.track_id AND at.album_id = ?
    LEFT JOIN albums alb ON at.album_id = alb.id
    LEFT JOIN track_artists ta ON t.id = ta.track_id
    LEFT JOIN artists a ON ta.artist_id = a.id`;

const TRACK_LIST_SELECT_ALBUM = `
    SELECT 
      t.id, t.title, t.rating, t.starred,
      COALESCE(t.year, alb.year) AS year, t.tags, t.play_count, t.last_played,
      COALESCE(t.volume_pct, 100) AS volume_pct,
      t.custom_cover_type, f.duration, f.format, f.bitrate, f.scanned_at,
      alb.id as albumId, alb.name as albumName, alb.cover_type as albumCoverType,
      at.track_number, at.disc_number,
      GROUP_CONCAT(a.name, ', ') as artist
    ${TRACK_LIST_FROM_ALBUM}`;

export function countTracks() {
  return db
    .prepare(`
      SELECT COUNT(*) AS total
      FROM track_metadata t
      JOIN track_filedata f ON t.file_id = f.id
    `)
    .get().total;
}

const TRACK_LIST_GROUP_ORDER = `GROUP BY t.id ORDER BY f.scanned_at DESC`;

export function countTracksFiltered(query = {}) {
  const filters = parseTrackListFilters(query);
  if (filters.albumId) {
    const withoutAlbum = { ...filters, albumId: null };
    const { where, params } = buildTrackListWhere(withoutAlbum);
    return db
      .prepare(`
        SELECT COUNT(*) AS total
        FROM track_metadata t
        JOIN track_filedata f ON t.file_id = f.id
        JOIN album_tracks at ON t.id = at.track_id AND at.album_id = ?
        ${where}
      `)
      .get(filters.albumId, ...params).total;
  }
  const { where, params } = buildTrackListWhere(filters);
  return db
    .prepare(`
      SELECT COUNT(*) AS total
      FROM track_metadata t
      JOIN track_filedata f ON t.file_id = f.id
      ${where}
    `)
    .get(...params).total;
}

export function findAllTracks() {
  return db.prepare(`${TRACK_LIST_SELECT} ${TRACK_LIST_GROUP_ORDER}`).all();
}

export function findTracksPage(offset, limit, query = {}) {
  const filters = parseTrackListFilters(query);
  const orderClause = buildTrackListOrder(filters.sorts);

  if (filters.albumId) {
    const withoutAlbum = { ...filters, albumId: null };
    const { where, params } = buildTrackListWhere(withoutAlbum);
    return db
      .prepare(`
        ${TRACK_LIST_SELECT_ALBUM}
        ${where}
        GROUP BY t.id, at.track_number, at.disc_number
        ${orderClause}
        LIMIT ? OFFSET ?
      `)
      .all(filters.albumId, ...params, limit, offset);
  }

  const { where, params } = buildTrackListWhere(filters);
  return db
    .prepare(`
      ${TRACK_LIST_SELECT}
      ${where}
      GROUP BY t.id
      ${orderClause}
      LIMIT ? OFFSET ?
    `)
    .all(...params, limit, offset);
}

export function findTracksByIds(ids) {
  const idList = [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
  if (idList.length === 0) return [];

  const placeholders = idList.map(() => '?').join(',');
  const rows = db
    .prepare(`${TRACK_LIST_SELECT} WHERE t.id IN (${placeholders}) ${TRACK_LIST_GROUP_ORDER}`)
    .all(...idList);

  const byId = new Map(rows.map((r) => [String(r.id), r]));
  return idList.map((id) => byId.get(id)).filter(Boolean);
}

export function searchTracks(query, limit = 10) {
  const trimmed = String(query ?? '').trim();
  if (!trimmed) return [];

  const pattern = `%${trimmed}%`;
  const lim = Math.min(50, Math.max(1, Number(limit) || 10));

  return db
    .prepare(`
    ${TRACK_LIST_SELECT}
    WHERE t.title LIKE ? COLLATE NOCASE
       OR EXISTS (
         SELECT 1 FROM track_artists ta2
         JOIN artists a2 ON a2.id = ta2.artist_id
         WHERE ta2.track_id = t.id AND a2.name LIKE ? COLLATE NOCASE
       )
    ${TRACK_LIST_GROUP_ORDER}
    LIMIT ?
  `)
    .all(pattern, pattern, lim);
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

export function findTrackDetailById(id) {
  return db.prepare(`
    SELECT
      t.id, t.title, t.rating, t.starred, t.tags, t.genre,
      COALESCE(t.year, alb.year) AS year,
      t.year AS trackYear,
      alb.year AS albumYear,
      COALESCE(t.volume_pct, 100) AS volume_pct,
      t.play_count, t.last_played, t.custom_cover_type,
      f.duration, f.format, f.bitrate, f.path AS filePath, f.size AS fileSize,
      alb.id AS albumId, alb.name AS albumName, alb.cover_type AS albumCoverType,
      (SELECT json_group_array(json_object('id', a.id, 'name', a.name, 'role_mask', ta.role_mask))
        FROM track_artists ta JOIN artists a ON ta.artist_id = a.id WHERE ta.track_id = t.id) AS artists_json,
      (SELECT json_group_array(json_object(
        'id', al.id, 'name', al.name, 'year', al.year, 'cover_type', al.cover_type,
        'is_primary', at2.is_primary, 'disc_number', at2.disc_number, 'track_number', at2.track_number))
        FROM album_tracks at2 JOIN albums al ON at2.album_id = al.id WHERE at2.track_id = t.id) AS albums_json,
      (SELECT json_group_array(json_object('id', p.id, 'name', p.name, 'cover_type', p.cover_type, 'type', p.type))
        FROM playlist_tracks pt JOIN playlists p ON pt.playlist_id = p.id WHERE pt.track_id = t.id) AS playlists_json
    FROM track_metadata t
    JOIN track_filedata f ON t.file_id = f.id
    LEFT JOIN album_tracks at ON t.id = at.track_id AND at.is_primary = 1
    LEFT JOIN albums alb ON at.album_id = alb.id
    WHERE t.id = ?
  `).get(id);
}

export function findTrackForEnrich(id) {
  return db.prepare(`
    SELECT t.id, t.title, t.tags, t.genre,
      t.year AS year,
      alb.year AS albumYear,
      COALESCE(t.volume_pct, 100) AS volume_pct,
      alb.id AS currentAlbumId,
      alb.name AS albumName, alb.cover_type AS albumCoverType,
      (SELECT json_group_array(json_object('id', a.id, 'name', a.name, 'role_mask', ta.role_mask))
        FROM track_artists ta JOIN artists a ON ta.artist_id = a.id WHERE ta.track_id = t.id) as artists_json
    FROM track_metadata t
    LEFT JOIN album_tracks at ON t.id = at.track_id AND at.is_primary = 1
    LEFT JOIN albums alb ON at.album_id = alb.id
    WHERE t.id = ?
  `).get(id);
}

const PLAY_COUNT_THRESHOLD = 0.5;

/**
 * DB에 있는 파일 길이(초) 기준으로 절반 이상 재생(position_peak_sec)일 때만
 * play_history 삽입 + play_count 증가 + last_played 갱신.
 *
 * `listened_sec`은 도달한 최대 위치를 곡 길이로 잘라 실측값으로 저장한다.
 * 통계(홈 Top·차트)는 전부 이 컬럼 합계로 순위를 매기므로, 비워두면 해당 재생이
 * 집계에서 통째로 빠진다(`db.js`의 기동 시 백필은 레거시 행 전용).
 *
 * `deviceId`는 어느 기기에서 난 재생인지 사후 감사·필터용. null이면 '기기 미상'.
 * @param {string} trackId
 * @param {number} positionPeakSec
 * @param {string | null} [deviceId]
 * @returns {{ notFound: true } | { skipped: true, play_count: number } | { recorded: true, play_count: number, playHistoryId: number | null }}
 */
export function recordTrackPlayWithHistory(trackId, positionPeakSec, deviceId = null) {
  const row = db
    .prepare(
      `SELECT t.id, t.play_count, f.duration as file_duration_sec
       FROM track_metadata t
       JOIN track_filedata f ON t.file_id = f.id
       WHERE t.id = ?`
    )
    .get(trackId);

  if (!row) {
    return { notFound: true };
  }

  const durationSec = Number(row.file_duration_sec);
  const peak = Math.max(0, Number(positionPeakSec) || 0);
  const playCount = Number(row.play_count) || 0;

  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    return { skipped: true, play_count: playCount };
  }

  if (peak < durationSec * PLAY_COUNT_THRESHOLD) {
    return { skipped: true, play_count: playCount };
  }

  // 모바일 등에서 동일 곡 flush·ended가 연달아 오는 경우 중복 집계 방지
  const recentDup = db
    .prepare(
      `SELECT id FROM play_history
       WHERE track_id = ?
         AND played_at >= datetime('now', '-4 seconds')
       LIMIT 1`
    )
    .get(trackId);
  if (recentDup) {
    return { skipped: true, play_count: playCount };
  }

  const listenedSec = Math.round(Math.min(peak, durationSec));

  const tx = db.transaction(() => {
    const info = db
      .prepare('INSERT INTO play_history (track_id, listened_sec, device_id) VALUES (?, ?, ?)')
      .run(trackId, listenedSec, deviceId || null);
    db.prepare(
      `UPDATE track_metadata
       SET play_count = COALESCE(play_count, 0) + 1,
           last_played = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(trackId);
    return info.lastInsertRowid;
  });
  const insertedId = tx();
  const playHistoryId = insertedId != null ? Number(insertedId) : null;

  const after = db.prepare('SELECT play_count FROM track_metadata WHERE id = ?').get(trackId);
  return { recorded: true, play_count: after?.play_count ?? playCount + 1, playHistoryId };
}

/**
 * Last.fm 스크롭 성공 등으로 play_history.scrobbled 갱신
 */
export function markPlayHistoryScrobbled(playHistoryId, value = 1) {
  if (playHistoryId == null || !Number.isFinite(Number(playHistoryId))) return 0;
  return db.prepare('UPDATE play_history SET scrobbled = ? WHERE id = ?').run(value, playHistoryId).changes;
}

/** Last.fm용: 첫 주연 아티스트, 앨범명, 길이(초) */
export function getTrackScrobbleMeta(trackId) {
  return db
    .prepare(
      `
    SELECT t.title,
      (SELECT a.name FROM track_artists ta
       JOIN artists a ON a.id = ta.artist_id
       WHERE ta.track_id = t.id
       ORDER BY ta.role_mask
       LIMIT 1) AS artist,
      alb.name AS album,
      CAST(ROUND(f.duration) AS INTEGER) AS duration_sec
    FROM track_metadata t
    JOIN track_filedata f ON f.id = t.file_id
    LEFT JOIN album_tracks at ON at.track_id = t.id AND at.is_primary = 1
    LEFT JOIN albums alb ON alb.id = at.album_id
    WHERE t.id = ?
  `
    )
    .get(trackId);
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

/**
 * 여러 곡의 태그를 한 번에 넣고 뺀다.
 * 곡마다 기존 태그를 읽어 합집합/차집합만 적용하므로, 선택한 곡들의 태그가 서로 달라도 덮어쓰지 않는다.
 * 실제로 바뀐 곡만 `{ id, tags }`로 돌려준다 — 호출부가 그만큼만 화면에 반영하면 된다.
 */
export function bulkUpdateTrackTags(ids, { add = [], remove = [] } = {}) {
  const addNames = [...new Set(add)];
  const removeSet = new Set(remove);

  const select = db.prepare('SELECT tags FROM track_metadata WHERE id = ?');
  const update = db.prepare('UPDATE track_metadata SET tags = ? WHERE id = ?');

  const apply = db.transaction((trackIds) => {
    const changed = [];
    for (const id of trackIds) {
      const row = select.get(id);
      if (!row) continue;

      let current;
      try {
        current = JSON.parse(row.tags || '[]');
      } catch {
        current = [];
      }
      if (!Array.isArray(current)) current = [];

      const next = current.filter((tag) => !removeSet.has(tag));
      for (const tag of addNames) {
        if (!next.includes(tag)) next.push(tag);
      }

      const unchanged = next.length === current.length && next.every((tag, i) => tag === current[i]);
      if (unchanged) continue;

      update.run(JSON.stringify(next), id);
      changed.push({ id, tags: next });
    }
    return changed;
  });

  return apply(ids);
}

export function updateTrackMeta(id, { title, genre, tags, year, volume_pct }) {
  const yearProvided = year !== undefined;
  const yearValue =
    year == null || year === ''
      ? null
      : Number.isFinite(Number(year))
        ? Number(year)
        : null;

  const volumeProvided = volume_pct !== undefined;
  let volumeValue = 100;
  if (volumeProvided) {
    const n = Number(volume_pct);
    volumeValue = Number.isFinite(n) ? Math.min(150, Math.max(50, Math.round(n))) : 100;
  }

  db.prepare(`
    UPDATE track_metadata 
    SET title = COALESCE(?, title),
        genre = COALESCE(?, genre),
        tags = COALESCE(?, tags),
        year = CASE WHEN ? = 1 THEN ? ELSE year END,
        volume_pct = CASE WHEN ? = 1 THEN ? ELSE volume_pct END
    WHERE id = ?
  `).run(
    title,
    genre || null,
    tags ? JSON.stringify(tags) : null,
    yearProvided ? 1 : 0,
    yearValue,
    volumeProvided ? 1 : 0,
    volumeValue,
    id,
  );
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

export function findTrackFileForReplace(trackId) {
  return db.prepare(`
    SELECT
      t.id AS trackId, t.title, t.file_id AS fileId,
      f.path, f.format, f.size, f.duration, f.bitrate
    FROM track_metadata t
    JOIN track_filedata f ON t.file_id = f.id
    WHERE t.id = ?
  `).get(trackId);
}

export function findTrackEmbedTags(trackId) {
  return db.prepare(`
    SELECT
      t.title,
      (SELECT GROUP_CONCAT(a.name, ', ') FROM track_artists ta JOIN artists a ON ta.artist_id = a.id WHERE ta.track_id = t.id) AS artist,
      (SELECT al.name FROM album_tracks at JOIN albums al ON at.album_id = al.id WHERE at.track_id = t.id AND at.is_primary = 1 LIMIT 1) AS album
    FROM track_metadata t
    WHERE t.id = ?
  `).get(trackId);
}

export function findOtherTrackByFileId(fileId, excludeTrackId) {
  return db.prepare(`
    SELECT id FROM track_metadata WHERE file_id = ? AND id != ? LIMIT 1
  `).get(fileId, excludeTrackId);
}

/**
 * @param {string} trackId
 * @param {string} oldFileId
 * @param {{ id: string, path: string, size: number, duration: number, bitrate: number | null, format: string | null }} fileRow
 */
export function swapTrackFileRecord(trackId, oldFileId, fileRow) {
  db.transaction(() => {
    const existing = db.prepare('SELECT id FROM track_filedata WHERE id = ?').get(fileRow.id);
    if (existing) {
      db.prepare(`
        UPDATE track_filedata
        SET path = ?, size = ?, duration = ?, bitrate = ?, format = ?, source = 'replace', scanned_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(fileRow.path, fileRow.size, fileRow.duration, fileRow.bitrate, fileRow.format, fileRow.id);
    } else {
      db.prepare(`
        INSERT INTO track_filedata (id, path, size, duration, bitrate, format, source)
        VALUES (?, ?, ?, ?, ?, ?, 'replace')
      `).run(fileRow.id, fileRow.path, fileRow.size, fileRow.duration, fileRow.bitrate, fileRow.format);
    }

    db.prepare('UPDATE track_metadata SET file_id = ? WHERE id = ?').run(fileRow.id, trackId);

    if (oldFileId && oldFileId !== fileRow.id) {
      db.prepare('DELETE FROM track_filedata WHERE id = ?').run(oldFileId);
    }
  })();
}