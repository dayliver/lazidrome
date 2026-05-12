import { getDB } from '../db.js';

const db = getDB();

/** findAllTracks와 동일한 트랙 행 SELECT + 공통 JOIN */
const TRACK_LIST_SELECT = `
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
`;

const GROUP_BY_TRACK = 'GROUP BY t.id';

/**
 * @param {'24h'|'48h'|'7d'} windowKey
 * @returns {string} SQLite datetime('now', ...) 절단식
 */
function historyCutoffExpr(windowKey) {
  switch (windowKey) {
    case '24h':
      return "datetime('now', '-24 hours')";
    case '48h':
      return "datetime('now', '-48 hours')";
    case '7d':
    default:
      return "datetime('now', '-7 days')";
  }
}

/**
 * 창 안에서 재생된 적이 있는 트랙, 트랙당 가장 최근 재생 시각 기준 정렬
 */
export function findRecentPlayedTracks(windowKey, limit = 20) {
  const cutoff = historyCutoffExpr(windowKey);
  return db
    .prepare(`
    WITH recent AS (
      SELECT track_id, MAX(played_at) AS last_play
      FROM play_history
      WHERE played_at >= ${cutoff}
      GROUP BY track_id
    )
    ${TRACK_LIST_SELECT}
    JOIN recent r ON r.track_id = t.id
    ${GROUP_BY_TRACK}, r.last_play
    ORDER BY r.last_play DESC
    LIMIT ?
  `)
    .all(limit);
}

/** 별점 4+ 이고 창 안에는 재생 기록이 없는 트랙 — 별점 높은 순 우선 */
export function findRediscoverTracks(windowKey, limit = 20) {
  const cutoff = historyCutoffExpr(windowKey);
  return db
    .prepare(`
    ${TRACK_LIST_SELECT}
    WHERE COALESCE(t.rating, 0) >= 4
      AND NOT EXISTS (
        SELECT 1 FROM play_history h
        WHERE h.track_id = t.id AND h.played_at >= ${cutoff}
      )
    ${GROUP_BY_TRACK}
    ORDER BY COALESCE(t.rating, 0) DESC, COALESCE(t.play_count, 0) DESC, t.title
    LIMIT ?
  `)
    .all(limit);
}

/** 재생 횟수 많은 순, 동률이면 별점 높은 순 */
export function findMostPlayedTracks(limit = 20) {
  return db
    .prepare(`
    ${TRACK_LIST_SELECT}
    ${GROUP_BY_TRACK}
    ORDER BY COALESCE(t.play_count, 0) DESC, COALESCE(t.rating, 0) DESC, t.title
    LIMIT ?
  `)
    .all(limit);
}

/** 별표 트랙, 오래 전에 들었거나 미재생 우선 */
export function findStarredTracks(limit = 20) {
  return db
    .prepare(`
    ${TRACK_LIST_SELECT}
    WHERE COALESCE(t.starred, 0) = 1
    ${GROUP_BY_TRACK}
    ORDER BY CASE WHEN t.last_played IS NULL THEN 1 ELSE 0 END DESC, t.last_played ASC, t.title
    LIMIT ?
  `)
    .all(limit);
}
