import { getDB } from '../db.js';

export function getAggregatedTags() {
  const db = getDB();
  const query = `
    SELECT tag_name, SUM(cnt) as count 
    FROM (
      SELECT value as tag_name, COUNT(*) as cnt 
      FROM track_metadata, json_each(tags) 
      WHERE tags IS NOT NULL AND tags != '[]' 
      GROUP BY value
      
      UNION ALL
      
      SELECT value as tag_name, COUNT(*) as cnt 
      FROM albums, json_each(tags) 
      WHERE tags IS NOT NULL AND tags != '[]' 
      GROUP BY value
      
      UNION ALL
      
      SELECT value as tag_name, COUNT(*) as cnt 
      FROM artists, json_each(tags) 
      WHERE tags IS NOT NULL AND tags != '[]' 
      GROUP BY value
    )
    GROUP BY tag_name
    ORDER BY count DESC
  `;

  return db.prepare(query).all();
}

export function findArtistsWithTag(tagName) {
  const db = getDB();
  return db.prepare(`
    SELECT a.id, a.name, a.cover_type, a.tags,
      COUNT(DISTINCT ta.track_id) as trackCount,
      ROUND(AVG(NULLIF(t.rating, 0)), 1) as avgRating
    FROM artists a
    LEFT JOIN track_artists ta ON a.id = ta.artist_id
    LEFT JOIN track_metadata t ON ta.track_id = t.id
    WHERE a.tags IS NOT NULL AND a.tags != '[]'
      AND EXISTS (SELECT 1 FROM json_each(a.tags) j WHERE j.value = ?)
    GROUP BY a.id
    ORDER BY a.name COLLATE NOCASE ASC
  `).all(tagName);
}

export function findAlbumsWithTag(tagName) {
  const db = getDB();
  return db.prepare(`
    SELECT
      a.id, a.name, a.description, a.year, a.cover_type, a.tags,
      (SELECT GROUP_CONCAT(ar.name, ', ') FROM album_artists aa JOIN artists ar ON aa.artist_id = ar.id WHERE aa.album_id = a.id) as displayArtist,
      COUNT(DISTINCT t.id) as trackCount,
      SUM(f.duration) as totalDuration
    FROM albums a
    LEFT JOIN album_tracks at ON a.id = at.album_id
    LEFT JOIN track_metadata t ON at.track_id = t.id
    LEFT JOIN track_filedata f ON t.file_id = f.id
    WHERE a.tags IS NOT NULL AND a.tags != '[]'
      AND EXISTS (SELECT 1 FROM json_each(a.tags) j WHERE j.value = ?)
    GROUP BY a.id
    ORDER BY a.year DESC, a.name ASC
  `).all(tagName);
}

export function findTracksWithTag(tagName) {
  const db = getDB();
  return db.prepare(`
    SELECT
      t.id, t.title, t.rating, t.starred, t.year, t.tags, t.play_count, t.last_played,
      t.custom_cover_type, f.duration, f.format, f.bitrate,
      alb.id as albumId, alb.name as albumName, alb.cover_type as albumCoverType,
      GROUP_CONCAT(ar.name, ', ') as artist
    FROM track_metadata t
    JOIN track_filedata f ON t.file_id = f.id
    LEFT JOIN album_tracks at ON t.id = at.track_id AND at.is_primary = 1
    LEFT JOIN albums alb ON at.album_id = alb.id
    LEFT JOIN track_artists ta ON t.id = ta.track_id
    LEFT JOIN artists ar ON ta.artist_id = ar.id
    WHERE t.tags IS NOT NULL AND t.tags != '[]'
      AND EXISTS (SELECT 1 FROM json_each(t.tags) j WHERE j.value = ?)
    GROUP BY t.id
    ORDER BY f.scanned_at DESC
  `).all(tagName);
}

function replaceTagInJsonArray(json, oldName, newName) {
  let arr;
  try {
    arr = JSON.parse(json);
  } catch {
    return null;
  }
  if (!Array.isArray(arr) || !arr.includes(oldName)) return null;
  const next = [...new Set(arr.map((t) => (t === oldName ? newName : t)))];
  return JSON.stringify(next);
}

/**
 * 모든 엔티티의 tags JSON 배열에서 oldName을 newName으로 치환합니다.
 */
export function renameTagEverywhere(oldName, newName) {
  const db = getDB();
  const stats = { artists: 0, albums: 0, tracks: 0, playlists: 0 };

  const run = () => {
    const bumpTable = (table, col) => {
      const rows = db
        .prepare(`SELECT id, ${col} FROM ${table} WHERE ${col} IS NOT NULL AND ${col} != '[]'`)
        .all();
      const upd = db.prepare(`UPDATE ${table} SET ${col} = ? WHERE id = ?`);
      let n = 0;
      for (const row of rows) {
        const next = replaceTagInJsonArray(row[col], oldName, newName);
        if (next) {
          upd.run(next, row.id);
          n++;
        }
      }
      return n;
    };

    stats.artists = bumpTable('artists', 'tags');
    stats.albums = bumpTable('albums', 'tags');
    stats.tracks = bumpTable('track_metadata', 'tags');

    const playlists = db
      .prepare(`SELECT id, rules FROM playlists WHERE type = 'mix' AND rules IS NOT NULL`)
      .all();
    const updPl = db.prepare('UPDATE playlists SET rules = ? WHERE id = ?');
    for (const row of playlists) {
      try {
        const rules = JSON.parse(row.rules);
        let changed = false;
        for (const cond of rules.conditions || []) {
          if (cond.field === 'tags' && String(cond.value) === oldName) {
            cond.value = newName;
            changed = true;
          }
        }
        if (changed) {
          updPl.run(JSON.stringify(rules), row.id);
          stats.playlists++;
        }
      } catch {
        /* skip invalid rules */
      }
    }
  };

  db.transaction(run)();
  return stats;
}