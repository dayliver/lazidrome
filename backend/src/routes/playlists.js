import { getDB } from '../db.js';
import { ulid } from 'ulid';
import path from 'path';     // 💡 경로 처리를 위해 추가
import fs from 'fs';         // 💡 디렉토리 확인용 추가
import sharp from 'sharp';   // 💡 이미지 리사이징용 추가

export default async function playlistRoutes(fastify) {

  // =====================================================================
  // 🧠 [핵심 엔진] 스마트 믹스 동적 쿼리 생성기 (Query Builder)
  // =====================================================================
  const buildMixQuery = (rulesString) => {
    let rules;
    try {
      rules = JSON.parse(rulesString || '{}');
    } catch (e) {
      rules = { conditions: [] };
    }

    const conditions = rules.conditions || [];
    const matchType = rules.match === 'any' ? ' OR ' : ' AND '; // 기본값은 all(AND)
    
    let whereClauses = [];
    let params = [];

    // 조건식 파싱 및 SQL 맵핑
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
        case 'contains': 
          sqlOp = 'LIKE'; 
          sqlValue = `%${value}%`; 
          break;
        case 'not_contains':
          sqlOp = 'NOT LIKE';
          sqlValue = `%${value}%`;
          break;
      }

      // 안전한 필드명 매핑 (SQL 인젝션 방어)
      if (field === 'rating') {
        whereClauses.push(`t.rating ${sqlOp} ?`);
        params.push(sqlValue);
      } else if (field === 'tags') {
        whereClauses.push(`t.tags ${sqlOp} ?`);
        params.push(sqlValue);
      } else if (field === 'genre') {
        whereClauses.push(`t.genre ${sqlOp} ?`);
        params.push(sqlValue);
      } else if (field === 'play_count') {
        whereClauses.push(`t.play_count ${sqlOp} ?`);
        params.push(sqlValue);
      } else if (field === 'year') {
        whereClauses.push(`alb.year ${sqlOp} ?`);
        params.push(sqlValue);
      }
      // 💡 향후 last_played, play_day 등의 조건도 여기에 추가하면 무한 확장 가능!
    });

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(matchType)}` : '';

    // 정렬 방식 파싱
    let orderSql = 'ORDER BY RANDOM()'; // 기본값 랜덤
    if (rules.sortBy === 'newest') orderSql = 'ORDER BY t.created_at DESC';
    else if (rules.sortBy === 'oldest') orderSql = 'ORDER BY t.created_at ASC';
    else if (rules.sortBy === 'most_played') orderSql = 'ORDER BY t.play_count DESC';
    else if (rules.sortBy === 'highest_rated') orderSql = 'ORDER BY t.rating DESC';

    // Limit 파싱
    const limit = parseInt(rules.limit, 10) || 50;

    // 최종 트랙 조회 쿼리 조립 (기존 트랙 목록 포맷과 동일하게 맞춤)
    const finalSql = `
      SELECT 
        t.id, t.title, t.rating, t.play_count, t.tags,
        f.duration, 
        alb.id as albumId,
        alb.name as albumName,
        alb.cover_type as albumCoverType,
        (
          SELECT json_group_array(json_object('id', a.id, 'name', a.name))
          FROM track_artists ta
          JOIN artists a ON ta.artist_id = a.id
          WHERE ta.track_id = t.id
        ) as artists_json
      FROM track_metadata t
      JOIN track_filedata f ON t.file_id = f.id
      LEFT JOIN album_tracks at ON t.id = at.track_id AND at.is_primary = 1
      LEFT JOIN albums alb ON at.album_id = alb.id
      ${whereSql}
      ${orderSql}
      LIMIT ${limit}
    `;

    return { sql: finalSql, params };
  };

  // =====================================================================
  // 1. 플레이리스트 목록 전체 조회 (사이드바 용)
  // =====================================================================
  fastify.get('/api/playlists', async (request, reply) => {
    try {
      const db = getDB();
      const playlists = db.prepare(`
        SELECT id, name, description, cover_type, type, rules, created_at 
        FROM playlists 
        ORDER BY created_at DESC
      `).all();

      return playlists.map(p => ({
        ...p,
        rules: p.type === 'mix' && p.rules ? JSON.parse(p.rules) : null
      }));
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: '플레이리스트 목록 조회 실패' });
    }
  });

  // =====================================================================
  // 💡 [헬퍼 함수] Multipart vs JSON 완벽 파서
  // =====================================================================
  const parseRequest = async (request) => {
    let data = { name: '', description: '', type: 'list', rules: null, playlistTracks: [] };
    let coverBuffer = null;

    if (request.isMultipart()) {
      // 1. attachFieldsToBody: true 설정이 되어있는 경우
      if (request.body && request.body.name && request.body.name.value !== undefined) {
        data.name = request.body.name.value;
        data.description = request.body.description?.value;
        data.type = request.body.type?.value || 'list';
        data.rules = request.body.rules?.value;
        data.playlistTracks = request.body.playlistTracks?.value;
        if (request.body.newCoverFile) {
          coverBuffer = await request.body.newCoverFile.toBuffer();
        }
      } 
      // 2. 수동 Stream 파싱 모드인 경우
      else {
        const parts = request.parts();
        for await (const part of parts) {
          if (part.file && part.fieldname === 'newCoverFile') {
            coverBuffer = await part.toBuffer();
          } else {
            if (part.fieldname === 'name') data.name = part.value;
            if (part.fieldname === 'description') data.description = part.value;
            if (part.fieldname === 'type') data.type = part.value;
            if (part.fieldname === 'rules') data.rules = part.value;
            if (part.fieldname === 'playlistTracks') data.playlistTracks = part.value;
          }
        }
      }
    } else {
      // 3. 순수 JSON인 경우
      data = { ...request.body };
    }

    // 문자열로 넘어온 JSON 데이터 안전하게 파싱
    if (typeof data.rules === 'string') {
      try { data.rules = JSON.parse(data.rules); } catch(e) { data.rules = null; }
    }
    if (typeof data.playlistTracks === 'string') {
      try { data.playlistTracks = JSON.parse(data.playlistTracks); } catch(e) { data.playlistTracks = []; }
    }

    return { data, coverBuffer };
  };

  // =====================================================================
  // 💡 이미지 디스크 저장 헬퍼 함수
  // =====================================================================
  const saveCoverImage = async (id, buffer) => {
    if (!buffer) return null;
    const uploadDir = path.join(process.cwd(), 'storage', 'images');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    
    const imagePath = path.join(uploadDir, `${id}.jpg`);
    await sharp(buffer)
      .resize(800, 800, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toFile(imagePath);
    
    return 'jpg'; // DB의 cover_type에 들어갈 값
  };

  // =====================================================================
  // 2. 새 플레이리스트 / 스마트 믹스 생성 (Multipart 완벽 지원)
  // =====================================================================
  fastify.post('/api/playlists', async (request, reply) => {
    try {
      const db = getDB();
      const id = ulid();
      const { data, coverBuffer } = await parseRequest(request);
      
      // 이미지 저장 (있을 경우)
      const coverType = await saveCoverImage(id, coverBuffer);

      const transaction = db.transaction(() => {
        db.prepare(`
          INSERT INTO playlists (id, name, description, type, rules, cover_type) 
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          id, 
          data.name, 
          data.description || null, 
          data.type || 'list', 
          data.type === 'mix' && data.rules ? JSON.stringify(data.rules) : null,
          coverType // 💡 null 또는 'jpg'
        );

        if (data.type === 'list' && Array.isArray(data.playlistTracks) && data.playlistTracks.length > 0) {
          const insertTrack = db.prepare('INSERT INTO playlist_tracks (id, playlist_id, track_id, position) VALUES (?, ?, ?, ?)');
          data.playlistTracks.forEach((track, index) => {
            insertTrack.run(ulid(), id, track.id || track.track_id, (index + 1) * 10);
          });
        }
      });

      transaction();

      const newPlaylist = db.prepare('SELECT * FROM playlists WHERE id = ?').get(id);
      if (newPlaylist.rules) newPlaylist.rules = JSON.parse(newPlaylist.rules);

      return { success: true, data: newPlaylist };
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: '플레이리스트 생성 실패' });
    }
  });

  // =====================================================================
  // 3. 특정 플레이리스트 상세 조회 (곡 목록 포함 - On-The-Fly 처리)
  // =====================================================================
  fastify.get('/api/playlists/:id', async (request, reply) => {
    try {
      const db = getDB();
      const { id } = request.params;

      const playlist = db.prepare('SELECT * FROM playlists WHERE id = ?').get(id);
      if (!playlist) return reply.code(404).send({ error: '플레이리스트를 찾을 수 없습니다.' });
      
      if (playlist.rules) playlist.rules = JSON.parse(playlist.rules);

      let tracks = [];

      if (playlist.type === 'list') {
        // 💡 수동 플레이리스트: playlist_tracks 테이블에서 position 순으로 가져옴
        tracks = db.prepare(`
          SELECT 
            pt.id as playlist_track_id, pt.position,
            t.id, t.title, t.rating, t.play_count, t.tags,
            f.duration, 
            alb.id as albumId, alb.name as albumName, alb.cover_type as albumCoverType,
            (
              SELECT json_group_array(json_object('id', a.id, 'name', a.name))
              FROM track_artists ta JOIN artists a ON ta.artist_id = a.id WHERE ta.track_id = t.id
            ) as artists_json
          FROM playlist_tracks pt
          JOIN track_metadata t ON pt.track_id = t.id
          JOIN track_filedata f ON t.file_id = f.id
          LEFT JOIN album_tracks at ON t.id = at.track_id AND at.is_primary = 1
          LEFT JOIN albums alb ON at.album_id = alb.id
          WHERE pt.playlist_id = ?
          ORDER BY pt.position ASC
        `).all(id);

      } else if (playlist.type === 'mix') {
        // 💡 스마트 믹스: On-The-Fly (실시간 쿼리 조립 및 실행)
        const { sql, params } = buildMixQuery(playlist.rules ? JSON.stringify(playlist.rules) : null);
        tracks = db.prepare(sql).all(...params);
      }

      // 아티스트 JSON 파싱 마무리
      tracks = tracks.map(t => {
        const parsedArtists = JSON.parse(t.artists_json || '[]');
        t.artist = parsedArtists.map(a => a.name).join(', '); // 💡 쉼표로 연결된 문자열로 변환!
        delete t.artists_json;
        return t;
      });

      return { ...playlist, tracks };
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: '상세 조회 실패' });
    }
  });

  // =====================================================================
  // 4. [수동] 플레이리스트에 곡 추가 (중복 허용)
  // =====================================================================
  fastify.post('/api/playlists/:id/tracks', async (request, reply) => {
    try {
      const db = getDB();
      const { id } = request.params;
      const { trackIds } = request.body; // 배열 형태로 한 번에 여러 곡 추가 지원

      if (!Array.isArray(trackIds) || trackIds.length === 0) return reply.code(400).send({ error: '추가할 곡이 없습니다.' });

      const playlist = db.prepare('SELECT type FROM playlists WHERE id = ?').get(id);
      if (playlist?.type !== 'list') return reply.code(400).send({ error: '수동 플레이리스트에만 곡을 추가할 수 있습니다.' });

      const transaction = db.transaction(() => {
        // 현재 가장 높은 position 값 조회 (없으면 0)
        let maxPos = db.prepare('SELECT COALESCE(MAX(position), 0) as maxPos FROM playlist_tracks WHERE playlist_id = ?').get(id).maxPos;
        
        const insertStmt = db.prepare('INSERT INTO playlist_tracks (id, playlist_id, track_id, position) VALUES (?, ?, ?, ?)');
        
        for (const trackId of trackIds) {
          maxPos += 10; // 💡 드래그 앤 드롭 순서 변경을 위해 10 단위로 띄워서 저장하는 것이 좋습니다.
          insertStmt.run(ulid(), id, trackId, maxPos);
        }
      });

      transaction();
      return { success: true };
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: '곡 추가 실패' });
    }
  });

  // =====================================================================
  // 5. [수동] 플레이리스트 곡 순서 변경 (Reorder)
  // =====================================================================
  fastify.put('/api/playlists/:id/tracks/reorder', async (request, reply) => {
    try {
      const db = getDB();
      const { id } = request.params;
      const { items } = request.body; // [{ playlistTrackId: '...', position: 1 }, ...]

      const transaction = db.transaction(() => {
        const updateStmt = db.prepare('UPDATE playlist_tracks SET position = ? WHERE id = ? AND playlist_id = ?');
        for (const item of items) {
          updateStmt.run(item.position, item.playlistTrackId, id);
        }
      });

      transaction();
      return { success: true };
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: '순서 변경 실패' });
    }
  });

  // =====================================================================
  // 6. [수동] 플레이리스트에서 곡 삭제
  // =====================================================================
  fastify.delete('/api/playlists/:id/tracks/:playlistTrackId', async (request, reply) => {
    try {
      const db = getDB();
      const { id, playlistTrackId } = request.params;

      db.prepare('DELETE FROM playlist_tracks WHERE id = ? AND playlist_id = ?').run(playlistTrackId, id);
      return { success: true };
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: '곡 삭제 실패' });
    }
  });

  // =====================================================================
  // 7. 플레이리스트 자체 삭제
  // =====================================================================
  fastify.delete('/api/playlists/:id', async (request, reply) => {
    try {
      const db = getDB();
      const { id } = request.params;

      // playlist_tracks는 FOREIGN KEY ON DELETE CASCADE가 설정되어 있어 자동 삭제됨
      db.prepare('DELETE FROM playlists WHERE id = ?').run(id);
      return { success: true };
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: '플레이리스트 삭제 실패' });
    }
  });

  // =====================================================================
  // 8. 플레이리스트 / 스마트 믹스 정보 수정 (PUT - Multipart 완벽 지원)
  // =====================================================================
  fastify.put('/api/playlists/:id', async (request, reply) => {
    try {
      const db = getDB();
      const { id } = request.params;
      
      const playlist = db.prepare('SELECT type, cover_type FROM playlists WHERE id = ?').get(id);
      if (!playlist) return reply.code(404).send({ error: '플레이리스트를 찾을 수 없습니다' });

      const { data, coverBuffer } = await parseRequest(request);
      
      // 이미지 덮어쓰기 (있을 경우)
      const newCoverType = await saveCoverImage(id, coverBuffer);
      const finalCoverType = newCoverType || playlist.cover_type; // 새 이미지가 없으면 기존 것 유지

      const transaction = db.transaction(() => {
        db.prepare(`
          UPDATE playlists 
          SET name = ?, description = ?, rules = ?, cover_type = ?
          WHERE id = ?
        `).run(
          data.name,
          data.description || null,
          data.rules ? JSON.stringify(data.rules) : null,
          finalCoverType,
          id
        );

        if (playlist.type === 'list' && Array.isArray(data.playlistTracks)) {
          db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ?').run(id);

          if (data.playlistTracks.length > 0) {
            const insertTrack = db.prepare('INSERT INTO playlist_tracks (id, playlist_id, track_id, position) VALUES (?, ?, ?, ?)');
            data.playlistTracks.forEach((track, index) => {
              // 새로 추가된 곡(track.id)과 기존에 있던 곡(track.track_id) 혼용 방어
              const trackIdToInsert = track.id || track.track_id; 
              insertTrack.run(ulid(), id, trackIdToInsert, (index + 1) * 10);
            });
          }
        }
      });

      transaction();

      const updatedPlaylist = db.prepare('SELECT * FROM playlists WHERE id = ?').get(id);
      if (updatedPlaylist.rules) updatedPlaylist.rules = JSON.parse(updatedPlaylist.rules);

      return { success: true, data: updatedPlaylist };
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: '플레이리스트 수정 실패' });
    }
  });
}