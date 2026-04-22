import { getDB } from '../db.js';

export default async function tagRoutes(fastify) {
  const db = getDB();

  // 1. 전체 태그 목록 및 통계 조회
  fastify.get('/api/tags', async (request, reply) => {
    try {
      // 💉 SQLite의 json_each()를 사용하여 JSON 배열 내의 태그들을 개별 행으로 분리한 뒤 집계합니다.
      const tags = db.prepare(`
        SELECT 
          json_each.value as name, 
          COUNT(track_metadata.id) as trackCount,
          SUM(track_metadata.play_count) as totalPlays
        FROM track_metadata, json_each(track_metadata.tags)
        WHERE track_metadata.tags IS NOT NULL 
          AND track_metadata.tags != '[]'
        GROUP BY json_each.value
        ORDER BY trackCount DESC, name ASC
      `).all();

      return tags;
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: '태그 목록을 가져오는 중 오류가 발생했습니다.' });
    }
  });

  // 2. 특정 태그가 포함된 곡 목록 조회 (스마트 플레이리스트의 근간)
  fastify.get('/api/tags/:name/tracks', async (request, reply) => {
    const { name } = request.params;
    try {
      // 💉 수정완료: album_tracks 교차 테이블을 거쳐 대표 앨범(is_primary = 1)을 조인합니다.
      const tracks = db.prepare(`
        SELECT 
          t.id, t.title, t.rating, t.play_count, t.year,
          f.duration,
          alb.id as albumId,
          alb.name as albumName,
          GROUP_CONCAT(ar.name, ', ') as artist
        FROM track_metadata t
        JOIN track_filedata f ON t.file_id = f.id
        LEFT JOIN album_tracks at ON t.id = at.track_id AND at.is_primary = 1
        LEFT JOIN albums alb ON at.album_id = alb.id
        LEFT JOIN track_artists ta ON t.id = ta.track_id
        LEFT JOIN artists ar ON ta.artist_id = ar.id
        WHERE EXISTS (
          SELECT 1 FROM json_each(t.tags) WHERE json_each.value = ?
        )
        GROUP BY t.id
        ORDER BY t.play_count DESC
      `).all(name);

      return tracks;
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: '태그 곡 목록을 가져오는 중 오류가 발생했습니다.' });
    }
  });
}