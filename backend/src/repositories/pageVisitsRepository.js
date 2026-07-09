import { getDB } from '../db.js';

const db = getDB();

export const VISIT_ENTITY_TYPES = new Set(['playlist', 'album', 'artist', 'tag', 'track']);
export const VISIT_WINDOW_DAYS = 7;
export const VISIT_DEBOUNCE_SEC = 30;

/** @returns {string} SQLite datetime (UTC) */
function msToSqliteDatetime(ms) {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

const nameStmt = {
  track: db.prepare('SELECT title AS name FROM track_metadata WHERE id = ?'),
  album: db.prepare('SELECT name FROM albums WHERE id = ?'),
  artist: db.prepare('SELECT name FROM artists WHERE id = ?'),
  playlist: db.prepare('SELECT name FROM playlists WHERE id = ?'),
};

export function pruneOldVisits() {
  db.prepare(
    `DELETE FROM page_visits WHERE visited_at < datetime('now', ?)`,
  ).run(`-${VISIT_WINDOW_DAYS} days`);
}

/**
 * 삭제된 앨범·아티스트·트랙·플레이리스트에 대한 방문 기록을 제거한다.
 * (홈 "자주 찾은 항목"에 유령 카드가 남는 것을 막음)
 */
export function pruneOrphanVisits() {
  return db
    .prepare(
      `
      DELETE FROM page_visits
      WHERE
        (entity_type = 'album' AND entity_id NOT IN (SELECT id FROM albums))
        OR (entity_type = 'artist' AND entity_id NOT IN (SELECT id FROM artists))
        OR (entity_type = 'track' AND entity_id NOT IN (SELECT id FROM track_metadata))
        OR (entity_type = 'playlist' AND entity_id NOT IN (SELECT id FROM playlists))
    `,
    )
    .run().changes;
}

/** @returns {boolean} */
export function entityExists(type, id) {
  const sid = id != null ? String(id).trim() : '';
  if (!sid) return false;
  if (type === 'tag') return true;
  const stmt = nameStmt[type];
  if (!stmt) return false;
  return !!stmt.get(sid);
}

export function hasRecentVisit(entityType, entityId, withinSeconds = VISIT_DEBOUNCE_SEC) {
  const row = db
    .prepare(
      `SELECT 1 AS ok FROM page_visits
       WHERE entity_type = ? AND entity_id = ?
         AND visited_at >= datetime('now', ?)
       LIMIT 1`,
    )
    .get(entityType, entityId, `-${withinSeconds} seconds`);
  return !!row;
}

export function insertVisit(entityType, entityId, visitedAtMs = null) {
  if (visitedAtMs != null) {
    const dt = msToSqliteDatetime(visitedAtMs);
    if (!dt) return false;
    db.prepare(
      `INSERT INTO page_visits (entity_type, entity_id, visited_at) VALUES (?, ?, ?)`,
    ).run(entityType, entityId, dt);
    return true;
  }
  db.prepare(
    `INSERT INTO page_visits (entity_type, entity_id) VALUES (?, ?)`,
  ).run(entityType, entityId);
  return true;
}

/**
 * @param {number} [limit=24]
 * @returns {{ type: string, id: string, count: number, at: string }[]}
 */
export function findFrequentVisits(limit = 24) {
  pruneOldVisits();
  pruneOrphanVisits();
  const cap = Math.min(50, Math.max(1, Number(limit) || 24));
  return db
    .prepare(
      `SELECT
         entity_type AS type,
         entity_id AS id,
         COUNT(*) AS count,
         MAX(visited_at) AS at
       FROM page_visits
       WHERE visited_at >= datetime('now', ?)
       GROUP BY entity_type, entity_id
       ORDER BY count DESC, at DESC
       LIMIT ?`,
    )
    .all(`-${VISIT_WINDOW_DAYS} days`, cap);
}

/**
 * @param {{ entity_type: string, entity_id: string, visited_at: string }[]} rows
 */
export function bulkInsertVisits(rows) {
  if (!rows.length) return 0;
  const stmt = db.prepare(
    `INSERT INTO page_visits (entity_type, entity_id, visited_at) VALUES (?, ?, ?)`,
  );
  let n = 0;
  const run = db.transaction((items) => {
    for (const row of items) {
      stmt.run(row.entity_type, row.entity_id, row.visited_at);
      n += 1;
    }
  });
  run(rows);
  return n;
}

export function clearAllVisits() {
  return db.prepare('DELETE FROM page_visits').run().changes;
}

/** @returns {string} */
export function resolveEntityDisplayName(type, id) {
  if (type === 'tag') return String(id);
  const stmt = nameStmt[type];
  if (!stmt) return '';
  const row = stmt.get(id);
  return row?.name ? String(row.name) : '';
}
