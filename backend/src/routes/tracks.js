import { getDB } from '../db.js';

export default async function trackRoutes(fastify) {
  // 1. 전체 곡 목록 조회
  fastify.get('/api/tracks', async (request, reply) => {
    try {
      const db = getDB();

      const statement = db.prepare(`
        SELECT 
          t.id, 
          t.title, 
          t.rating, 
          t.starred,
          t.year,
          t.tags, 
          t.play_count, 
          t.last_played,
          t.custom_cover_type, -- 💉 추가: 곡 개별 커버 정보
          f.duration, 
          f.format, 
          f.bitrate,
          alb.id as albumId,
          alb.name as albumName,
          alb.cover_type as albumCoverType, -- 💉 추가: 소속 앨범의 커버 정보
          GROUP_CONCAT(a.name, ', ') as artist
        FROM track_metadata t
        JOIN track_filedata f ON t.file_id = f.id
        -- album_tracks 테이블을 거쳐 대표 앨범(is_primary = 1)만 조인합니다.
        LEFT JOIN album_tracks at ON t.id = at.track_id AND at.is_primary = 1
        LEFT JOIN albums alb ON at.album_id = alb.id
        LEFT JOIN track_artists ta ON t.id = ta.track_id
        LEFT JOIN artists a ON ta.artist_id = a.id
        GROUP BY t.id
        ORDER BY f.scanned_at DESC
      `);
      
      const tracks = statement.all();
      
      return tracks.map(track => ({
        ...track,
        tags: JSON.parse(track.tags || '[]')
      }));
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: '트랙 목록을 가져오는 중 서버 오류가 발생했습니다.' });
    }
  });

  // 2. 곡 정보 수정 (별점, 태그)
  fastify.patch('/api/tracks/:id', async (request, reply) => {
    const db = getDB(); 
    const { id } = request.params;
    const { rating, tags } = request.body;

    try {
      const update = db.prepare(`
        UPDATE track_metadata 
        SET rating = COALESCE(?, rating), 
            tags = COALESCE(?, tags)
        WHERE id = ?
      `);

      const result = update.run(
        rating, 
        tags ? JSON.stringify(tags) : null, 
        id
      );

      if (result.changes === 0) {
        return reply.code(404).send({ error: 'Track not found' });
      }

      return { success: true };
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: '업데이트 중 오류가 발생했습니다.' });
    }
  });
}