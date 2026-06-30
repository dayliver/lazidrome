import { getDB } from '../db.js';

export function findTrackFileInfo(id) {
  const db = getDB();
  return db.prepare(`
    SELECT f.path, f.size, f.format, f.duration AS duration_sec
    FROM track_metadata t
    JOIN track_filedata f ON t.file_id = f.id
    WHERE t.id = ?
  `).get(id);
}

export function findTracksPlaylistMetaByIds(ids) {
  if (!Array.isArray(ids) || !ids.length) return [];
  const db = getDB();
  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT t.id, t.title, f.duration AS duration_sec, f.format
    FROM track_metadata t
    JOIN track_filedata f ON t.file_id = f.id
    WHERE t.id IN (${placeholders})
  `).all(...ids);
  const byId = new Map(rows.map((r) => [String(r.id), r]));
  return ids.map((id) => byId.get(String(id))).filter(Boolean);
}