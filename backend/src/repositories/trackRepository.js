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

const PLAY_COUNT_THRESHOLD = 0.5;

/**
 * DB에 있는 파일 길이(초) 기준으로 절반 이상 재생(position_peak_sec)일 때만
 * play_history 삽입 + play_count 증가 + last_played 갱신.
 * @returns {{ notFound: true } | { skipped: true, play_count: number } | { recorded: true, play_count: number, playHistoryId: number | null }}
 */
export function recordTrackPlayWithHistory(trackId, positionPeakSec) {
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

  const tx = db.transaction(() => {
    db.prepare('INSERT INTO play_history (track_id) VALUES (?)').run(trackId);
    db.prepare(
      `UPDATE track_metadata
       SET play_count = COALESCE(play_count, 0) + 1,
           last_played = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(trackId);
  });
  tx();

  const hid = db.prepare('SELECT last_insert_rowid() AS id').get();
  const playHistoryId = hid?.id != null ? Number(hid.id) : null;

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
      CAST(ROUND(f.duration)) AS duration_sec
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