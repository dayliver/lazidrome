import { getDB } from '../db.js';
import { ulid } from 'ulid';

export const DEFAULT_MIX_LIMIT = 50;
export const MAX_MIX_LIMIT = 200;

export function clampMixLimit(raw) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_MIX_LIMIT;
  return Math.min(MAX_MIX_LIMIT, n);
}

// 🧠 [핵심 엔진] 스마트 믹스 동적 쿼리 생성기
export function buildMixQuery(rulesString) {
  let rules;
  try { rules = JSON.parse(rulesString || '{}'); } catch (e) { rules = { conditions: [] }; }

  const conditions = rules.conditions || [];
  const matchType = rules.match === 'any' ? ' OR ' : ' AND ';
  let whereClauses = [];
  let params = [];

  conditions.forEach(cond => {
    const { field, operator, value } = cond;
    if (value === undefined || value === null || value === '') return;

    let sqlOp = '=';
    let sqlValue = value;

    switch (operator) {
      case '>=': sqlOp = '>='; break;
      case '<=': sqlOp = '<='; break;
      case '>': sqlOp = '>'; break;
      case '<': sqlOp = '<'; break;
      case '!=': sqlOp = '!='; break;
      case 'contains': sqlOp = 'LIKE'; sqlValue = `%${value}%`; break;
      case 'not_contains': sqlOp = 'NOT LIKE'; sqlValue = `%${value}%`; break;
    }

    if (field === 'rating') { whereClauses.push(`t.rating ${sqlOp} ?`); params.push(sqlValue); }
    else if (field === 'tags') { whereClauses.push(`t.tags ${sqlOp} ?`); params.push(sqlValue); }
    else if (field === 'genre') { whereClauses.push(`t.genre ${sqlOp} ?`); params.push(sqlValue); }
    else if (field === 'play_count') { whereClauses.push(`t.play_count ${sqlOp} ?`); params.push(sqlValue); }
    else if (field === 'year') { whereClauses.push(`alb.year ${sqlOp} ?`); params.push(sqlValue); }
  });

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(matchType)}` : '';

  let orderSql = 'ORDER BY RANDOM()';
  if (rules.sortBy === 'newest') orderSql = 'ORDER BY t.created_at DESC';
  else if (rules.sortBy === 'oldest') orderSql = 'ORDER BY t.created_at ASC';
  else if (rules.sortBy === 'most_played') orderSql = 'ORDER BY t.play_count DESC';
  else if (rules.sortBy === 'highest_rated') orderSql = 'ORDER BY t.rating DESC';

  const limit = clampMixLimit(rules.limit);

  const finalSql = `
    SELECT 
      t.id, t.title, t.rating, t.play_count, t.tags, f.duration, 
      alb.id as albumId, alb.name as albumName, alb.cover_type as albumCoverType,
      (SELECT json_group_array(json_object('id', a.id, 'name', a.name))
       FROM track_artists ta JOIN artists a ON ta.artist_id = a.id WHERE ta.track_id = t.id) as artists_json
    FROM track_metadata t
    JOIN track_filedata f ON t.file_id = f.id
    LEFT JOIN album_tracks at ON t.id = at.track_id AND at.is_primary = 1
    LEFT JOIN albums alb ON at.album_id = alb.id
    ${whereSql} ${orderSql} LIMIT ?
  `;

  return { sql: finalSql, params: [...params, limit] };
}

// 💡 생성 로직 (Transaction)
function rulesForStorage(type, rules) {
  if (type !== 'mix' || !rules) return null;
  return JSON.stringify({ ...rules, limit: clampMixLimit(rules.limit) });
}

export function createPlaylistTransaction(id, data, coverType) {
  const db = getDB();
  const type = data.type || 'list';
  db.transaction(() => {
    db.prepare(`INSERT INTO playlists (id, name, description, type, rules, cover_type) VALUES (?, ?, ?, ?, ?, ?)`).run(
      id, data.name, data.description || null, type,
      rulesForStorage(type, data.rules), coverType
    );

    if (data.type === 'list' && Array.isArray(data.playlistTracks) && data.playlistTracks.length > 0) {
      const insertTrack = db.prepare('INSERT INTO playlist_tracks (id, playlist_id, track_id, position) VALUES (?, ?, ?, ?)');
      data.playlistTracks.forEach((track, index) => {
        insertTrack.run(ulid(), id, track.id || track.track_id, (index + 1) * 10);
      });
    }
  })();
}

// 💡 수정 로직 (Transaction)
export function updatePlaylistTransaction(id, data, finalCoverType, playlistType) {
  const db = getDB();
  db.transaction(() => {
    db.prepare(`UPDATE playlists SET name = ?, description = ?, rules = ?, cover_type = ? WHERE id = ?`).run(
      data.name, data.description || null, rulesForStorage(playlistType, data.rules), finalCoverType, id
    );

    if (playlistType === 'list' && Array.isArray(data.playlistTracks)) {
      db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ?').run(id);
      if (data.playlistTracks.length > 0) {
        const insertTrack = db.prepare('INSERT INTO playlist_tracks (id, playlist_id, track_id, position) VALUES (?, ?, ?, ?)');
        data.playlistTracks.forEach((track, index) => {
          insertTrack.run(ulid(), id, track.id || track.track_id, (index + 1) * 10);
        });
      }
    }
  })();
}

// 💡 트랙 수동 추가 로직 (Transaction)
export function addTracksTransaction(playlistId, trackIds) {
  const db = getDB();
  db.transaction(() => {
    let maxPos = db.prepare('SELECT COALESCE(MAX(position), 0) as maxPos FROM playlist_tracks WHERE playlist_id = ?').get(playlistId).maxPos;
    const insertStmt = db.prepare('INSERT INTO playlist_tracks (id, playlist_id, track_id, position) VALUES (?, ?, ?, ?)');
    for (const trackId of trackIds) {
      maxPos += 10;
      insertStmt.run(ulid(), playlistId, trackId, maxPos);
    }
  })();
}

// 💡 트랙 순서 변경 로직 (Transaction)
export function reorderTracksTransaction(playlistId, items) {
  const db = getDB();
  db.transaction(() => {
    const updateStmt = db.prepare('UPDATE playlist_tracks SET position = ? WHERE id = ? AND playlist_id = ?');
    for (const item of items) {
      updateStmt.run(item.position, item.playlistTrackId, playlistId);
    }
  })();
}