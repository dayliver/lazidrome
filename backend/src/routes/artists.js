import { getDB } from '../db.js';

export default async function artistRoutes(fastify) {
  
  // 1. 아티스트 목록 조회 (통계, 주요 태그, 대표곡 포함)
  fastify.get('/api/artists', async (request, reply) => {
    try {
      const db = getDB();

      const artists = db.prepare(`
        SELECT 
          a.id, 
          a.name, 
          a.cover_type, -- 💉 수정: has_cover 대신 cover_type 조회
          COUNT(DISTINCT ta.track_id) as trackCount,
          ROUND(AVG(NULLIF(t.rating, 0)), 1) as avgRating,
          GROUP_CONCAT(t.tags, '||') as all_tags
        FROM artists a
        LEFT JOIN track_artists ta ON a.id = ta.artist_id
        LEFT JOIN track_metadata t ON ta.track_id = t.id
        GROUP BY a.id
        ORDER BY a.name COLLATE NOCASE ASC
      `).all();

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

      const formattedArtists = artists.map(artist => {
        let topTags = [];
        
        if (artist.all_tags) {
          const tagCounts = {};
          artist.all_tags.split('||').forEach(tagString => {
            if (!tagString) return;
            try {
              const tags = JSON.parse(tagString);
              tags.forEach(tag => {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
              });
            } catch (e) {
              // 에러 무시
            }
          });
          
          topTags = Object.entries(tagCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2)
            .map(entry => entry[0]);
        }

        return {
          id: artist.id,
          name: artist.name,
          cover_type: artist.cover_type,
          trackCount: artist.trackCount,
          avgRating: artist.avgRating || 0,
          topTags: topTags,
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