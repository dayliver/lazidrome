import { getDB } from '../db.js';

export default async function albumRoutes(fastify) {
  const db = getDB();

  // 1. 전체 앨범 목록 조회
  fastify.get('/api/albums', async (request, reply) => {
    try {
      // 💉 v2.1 다대다 스키마 반영: 
      // album_artists 테이블을 서브쿼리로 연결해 여러 아티스트를 쉼표로 묶어 displayArtist 생성
      const albums = db.prepare(`
        SELECT 
          a.id, 
          a.name, 
          a.year, 
          a.cover_type,
          (
            SELECT GROUP_CONCAT(ar.name, ', ')
            FROM album_artists aa
            JOIN artists ar ON aa.artist_id = ar.id
            WHERE aa.album_id = a.id
          ) as displayArtist,
          COUNT(DISTINCT t.id) as trackCount,
          SUM(f.duration) as totalDuration
        FROM albums a
        LEFT JOIN album_tracks at ON a.id = at.album_id
        LEFT JOIN track_metadata t ON at.track_id = t.id
        LEFT JOIN track_filedata f ON t.file_id = f.id
        GROUP BY a.id
        ORDER BY a.year DESC, a.name ASC
      `).all();

      return albums;
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: '앨범 목록을 가져오는 중 오류가 발생했습니다.' });
    }
  });

  // 2. 특정 앨범 상세 조회
  fastify.get('/api/albums/:id', async (request, reply) => {
    const { id } = request.params;

    try {
      // 2-1. 앨범 기본 정보 및 메인 아티스트 이름, 총 재생 시간 가져오기
      // 💉 앨범 상세 정보도 서브쿼리를 이용하여 카테시안 곱(데이터 뻥튀기) 에러 원천 차단
      const album = db.prepare(`
        SELECT 
          a.id, a.name, a.year, a.cover_type,
          (
            SELECT GROUP_CONCAT(ar.name, ', ')
            FROM album_artists aa
            JOIN artists ar ON aa.artist_id = ar.id
            WHERE aa.album_id = a.id
          ) as displayArtist,
          (
            SELECT SUM(f.duration)
            FROM album_tracks at
            JOIN track_metadata t ON at.track_id = t.id
            JOIN track_filedata f ON t.file_id = f.id
            WHERE at.album_id = a.id
          ) as totalDuration
        FROM albums a
        WHERE a.id = ?
      `).get(id);

      if (!album) {
        return reply.code(404).send({ error: 'Album not found' });
      }

      // 2-2. 앨범에 속한 곡 목록 가져오기
      // (트랙-아티스트 관계인 track_artists는 변경되지 않았으므로 기존 쿼리 유지)
      const tracks = db.prepare(`
        SELECT 
          t.id, t.title, t.rating, t.play_count, 
          f.duration,
          at.track_number, at.disc_number,
          GROUP_CONCAT(ar.name, ', ') as artist
        FROM track_metadata t
        JOIN album_tracks at ON t.id = at.track_id
        JOIN track_filedata f ON t.file_id = f.id
        LEFT JOIN track_artists ta ON t.id = ta.track_id
        LEFT JOIN artists ar ON ta.artist_id = ar.id
        WHERE at.album_id = ?
        GROUP BY t.id, at.track_number, at.disc_number
        ORDER BY at.disc_number ASC, at.track_number ASC, t.title ASC
      `).all(id);

      // 2-3. 합쳐서 프론트엔드로 전송
      return {
        ...album,
        tracks
      };
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: '앨범 상세 정보를 가져오는 중 오류가 발생했습니다.' });
    }
  });
}