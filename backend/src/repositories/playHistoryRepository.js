import { getDB } from '../db.js';

const db = getDB();

const HISTORY_SELECT = `
  SELECT
    h.id,
    h.played_at,
    h.track_id,
    h.scrobbled,
    t.title,
    t.custom_cover_type,
    (SELECT GROUP_CONCAT(a.name, ', ')
     FROM track_artists ta
     JOIN artists a ON a.id = ta.artist_id
     WHERE ta.track_id = t.id) AS artist,
    (SELECT alb.cover_type
     FROM album_tracks at
     JOIN albums alb ON alb.id = at.album_id
     WHERE at.track_id = t.id AND at.is_primary = 1
     LIMIT 1) AS album_cover_type
  FROM play_history h
  JOIN track_metadata t ON t.id = h.track_id
`;

export function countPlayHistory() {
  return db.prepare('SELECT COUNT(*) AS total FROM play_history').get().total;
}

/**
 * @param {{ limit?: number, offset?: number }} opts
 */
export function listPlayHistory({ limit = 50, offset = 0 } = {}) {
  const lim = Math.min(100, Math.max(1, Number(limit) || 50));
  const off = Math.max(0, Number(offset) || 0);

  const items = db
    .prepare(
      `${HISTORY_SELECT}
       ORDER BY h.played_at DESC, h.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(lim, off);

  return {
    items,
    total: countPlayHistory(),
    limit: lim,
    offset: off,
  };
}
