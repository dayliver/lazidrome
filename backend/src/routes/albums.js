import { getDB } from '../db.js';

export default async function albumRoutes(fastify) {
  const db = getDB();

  // 1. 전체 앨범 목록 조회
  fastify.get('/api/albums', async (request, reply) => {
    try {
      // 💉 v2.1 스키마 반영: album_tracks 교차 테이블을 통해 조인합니다.
      const albums = db.prepare(`
        SELECT 
          a.id, 
          a.name, 
          a.year, 
          a.cover_type, -- 💉 수정: has_cover 대신 cover_type 조회
          ar.name as displayArtist,
          COUNT(t.id) as trackCount,
          SUM(f.duration) as totalDuration
        FROM albums a
        LEFT JOIN artists ar ON a.main_artist_id = ar.id
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
      // 💉 여기도 album_tracks 교차 테이블을 통과해야 합니다.
      const album = db.prepare(`
        SELECT 
          a.id, a.name, a.year, a.cover_type, -- 💉 수정: has_cover 대신 cover_type 조회
          ar.name as displayArtist,
          SUM(f.duration) as totalDuration
        FROM albums a
        LEFT JOIN artists ar ON a.main_artist_id = ar.id
        LEFT JOIN album_tracks at ON a.id = at.album_id
        LEFT JOIN track_metadata t ON at.track_id = t.id
        LEFT JOIN track_filedata f ON t.file_id = f.id
        WHERE a.id = ?
        GROUP BY a.id
      `).get(id);

      if (!album) {
        return reply.code(404).send({ error: 'Album not found' });
      }

      // 2-2. 앨범에 속한 곡 목록 가져오기 (가수 이름도 예쁘게 묶어서)
      // 💉 v2.1 스키마의 꽃: album_tracks의 disc_number, track_number를 가져와 완벽하게 정렬합니다.
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