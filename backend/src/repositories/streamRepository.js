import { getDB } from '../db.js';

export function findTrackFileInfo(id) {
  const db = getDB();
  return db.prepare(`
    SELECT f.path, f.size, f.format 
    FROM track_metadata t
    JOIN track_filedata f ON t.file_id = f.id
    WHERE t.id = ?
  `).get(id);
}