import { getDB } from '../db.js';

export default async function artistRoutes(fastify) {
  
  // 1. 아티스트 목록 조회 (통계, 주요 태그, 대표곡 포함)
  fastify.get('/api/artists', async (request, reply) => {
    try {
      const db = getDB();

      // 💡 수술: GROUP_CONCAT(t.tags) 삭제. 오직 a.tags(본인 태그)만 가져옵니다!
      const artists = db.prepare(`
        SELECT 
          a.id, 
          a.name, 
          a.cover_type, 
          a.tags,
          COUNT(DISTINCT ta.track_id) as trackCount,
          ROUND(AVG(NULLIF(t.rating, 0)), 1) as avgRating
        FROM artists a
        LEFT JOIN track_artists ta ON a.id = ta.artist_id
        LEFT JOIN track_metadata t ON ta.track_id = t.id
        GROUP BY a.id
        ORDER BY a.name COLLATE NOCASE ASC
      `).all();

      // 대표곡 3곡 가져오기 (이 로직은 순수하므로 그대로 유지)
      const topTracksData = db.prepare(`
        SELECT artist_id, track_id, title
        FROM (
          SELECT 
            ta.artist_id, 
            t.id as track_id, 
            t.title, 
            ROW_NUMBER() OVER(PARTITION BY ta.artist_id ORDER BY t.play_count DESC, t.rating DESC) as rn
          FROM track_artists ta
          JOIN track_metadata t ON ta.track_id = t.id
        )
        WHERE rn <= 3
      `).all();

      const topTracksMap = {};
      for (const row of topTracksData) {
        if (!topTracksMap[row.artist_id]) topTracksMap[row.artist_id] = [];
        topTracksMap[row.artist_id].push({ id: row.track_id, title: row.title });
      }

      // 💡 수술: 복잡한 태그 카운팅 로직 전면 폐기!
      const formattedArtists = artists.map(artist => {
        let parsedTags = [];
        
        // 오직 본인(artist)의 tags 컬럼만 파싱합니다. (목록 화면을 위해 최대 3개만 자름)
        if (artist.tags) {
          try {
            parsedTags = JSON.parse(artist.tags).slice(0, 3);
          } catch (e) {
            // 파싱 에러 시 빈 배열 유지
          }
        }

        return {
          id: artist.id,
          name: artist.name,
          cover_type: artist.cover_type,
          trackCount: artist.trackCount,
          avgRating: artist.avgRating || 0,
          topTags: parsedTags, // 프론트엔드가 topTags라는 이름의 배열을 기다립니다.
          topTracks: topTracksMap[artist.id] || []
        };
      });

      return formattedArtists;

    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: '아티스트 목록을 가져오는 중 오류가 발생했습니다.' });
    }
  });

  // 2. 특정 아티스트 상세 조회 (곡 목록, 세부 역할, 소개글 포함)
  fastify.get('/api/artists/:id', async (request, reply) => {
    try {
      const db = getDB();
      const { id } = request.params;

      // 💉 1. 아티스트 기본 정보 (a.* 로 가져오므로 cover_type이 자동으로 포함됩니다)
      const artist = db.prepare(`
        SELECT a.*, ab.biography as bio
        FROM artists a
        LEFT JOIN artist_biographies ab ON a.id = ab.artist_id AND ab.language = 'en'
        WHERE a.id = ?
      `).get(id);
      
      if (!artist) return reply.code(404).send({ error: 'Artist not found' });

      // 💉 2. 곡 목록 조회 시 album_tracks 테이블 경유 및 albumCoverType 추가
      const tracks = db.prepare(`
        SELECT 
          t.id, t.title, t.rating, t.play_count, 
          ta.role_mask,
          f.duration, 
          alb.id as albumId,
          alb.name as albumName,
          alb.cover_type as albumCoverType -- 💉 핵심 수술: 앨범 커버 확장자 정보 추가!
        FROM track_metadata t
        JOIN track_artists ta ON t.id = ta.track_id
        JOIN track_filedata f ON t.file_id = f.id
        LEFT JOIN album_tracks at ON t.id = at.track_id AND at.is_primary = 1
        LEFT JOIN albums alb ON at.album_id = alb.id
        WHERE ta.artist_id = ?
        ORDER BY t.play_count DESC, t.rating DESC
      `).all(id);

      return {
        ...artist,
        aliases: JSON.parse(artist.aliases || '{}'),
        tags: JSON.parse(artist.tags || '[]'),
        tracks
      };
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: '아티스트 상세 정보를 가져오는 중 오류가 발생했습니다.' });
    }
  });
}