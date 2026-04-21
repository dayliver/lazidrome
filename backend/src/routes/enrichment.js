import { getDB } from '../db.js';
import { lastfmService } from '../services/lastfmService.js';
import { ulid } from 'ulid';
// 💉 1. 방금 만든 다운로더를 불러옵니다!
import { downloadImage } from '../lib/downloader.js'; 
import path from 'node:path';

export default async function enrichmentRoutes(fastify) {
  const db = getDB();

  /**
   * 💡 Helper: 모드에 따른 병합 로직 (배열/문자열 처리)
   */
  const mergeTags = (localTags, externalTags, mode) => {
    if (mode === 'force') return externalTags;
    if (mode === 'fill' && (!localTags || localTags.length === 0)) return externalTags;
    
    // 기본적으로 합치고 중복 제거 (Set 활용)
    const localArr = localTags ? JSON.parse(localTags) : [];
    const merged = [...new Set([...localArr, ...externalTags])];
    return merged.length > 0 ? merged : null;
  };

  // =====================================================================
  // 1. 아티스트 정보 강화 (Bio 분리 스키마 반영)
  // =====================================================================
  fastify.post('/api/enrich/artist/:id', async (request, reply) => {
    const { id } = request.params;
    const mode = request.query.mode || 'preview'; 

    try {
      const artist = db.prepare('SELECT name, tags, mbid FROM artists WHERE id = ?').get(id);
      if (!artist) return reply.code(404).send({ error: 'Artist not found' });

      const info = await lastfmService.getArtistInfo(artist.name);
      if (!info) return reply.code(404).send({ error: 'Last.fm에서 정보를 찾을 수 없습니다.' });

      if (mode === 'preview') {
        const localBio = db.prepare('SELECT biography FROM artist_biographies WHERE artist_id = ? AND language = ?').get(id, 'en');
        return { success: true, mode, local: { ...artist, bio: localBio?.biography }, external: info };
      }

      const transaction = db.transaction(() => {
        const finalTags = mergeTags(artist.tags, info.tags, mode);
        
        db.prepare('UPDATE artists SET tags = ?, mbid = COALESCE(?, mbid) WHERE id = ?')
          .run(finalTags ? JSON.stringify(finalTags) : null, info.mbid || null, id);

        if (info.bio && (mode === 'force' || mode === 'fill')) {
          db.prepare(`
            INSERT INTO artist_biographies (artist_id, language, biography) 
            VALUES (?, 'en', ?)
            ON CONFLICT(artist_id, language) DO UPDATE SET biography = excluded.biography
          `).run(id, info.bio);
        }
      });
      transaction();

      return { success: true, mode, data: info };
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: '아티스트 강화 중 서버 오류 발생' });
    }
  });

  // =====================================================================
  // 2. 앨범 정보 강화
  // =====================================================================
  fastify.post('/api/enrich/album/:id', async (request, reply) => {
    const { id } = request.params;
    const mode = request.query.mode || 'preview';

    try {
      const album = db.prepare(`
        SELECT a.name, a.year, a.mbid, ar.name as artistName 
        FROM albums a
        LEFT JOIN artists ar ON a.main_artist_id = ar.id
        WHERE a.id = ?
      `).get(id);

      if (!album) return reply.code(404).send({ error: 'Album not found' });

      const cleanAlbumName = album.name.replace(/\s*\([^)]*\)/g, '').trim();
      const info = await lastfmService.getAlbumInfo(album.artistName, cleanAlbumName);
      
      if (!info) return reply.code(404).send({ error: 'Last.fm에서 앨범 정보를 찾을 수 없습니다.' });

      if (mode === 'preview') {
        return { success: true, mode, local: album, external: info };
      }

      const releaseYear = info.releaseDate ? parseInt(info.releaseDate.match(/\d{4}/)?.[0], 10) : null;
      const finalYear = (mode === 'fill' && album.year) ? album.year : (releaseYear || album.year);

      db.prepare('UPDATE albums SET year = ?, mbid = COALESCE(?, mbid) WHERE id = ?')
        .run(finalYear, info.mbid || null, id);

      return { success: true, mode, data: info };
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: '앨범 강화 중 서버 오류 발생' });
    }
  });

  // =====================================================================
  // 3. 트랙 정보 강화 (수동 검색, Title 덮어쓰기, 아티스트 교정, 이미지 다운로드)
  // =====================================================================
  fastify.post('/api/enrich/track/:id', async (request, reply) => {
    const { id } = request.params;
    const mode = request.query.mode || 'preview';
    
    const customTitle = request.query.title;
    const customArtist = request.query.artist;

    console.log(`\n▶️ [Enrich Track] 시작 - ID: ${id}, Mode: ${mode}`);

    try {
      const track = db.prepare(`
        SELECT t.id, t.title, t.tags, 
               GROUP_CONCAT(ar.name, ', ') as artistName,
               (SELECT a.id FROM artists a JOIN track_artists ta ON a.id = ta.artist_id WHERE ta.track_id = t.id ORDER BY ta.role_mask ASC LIMIT 1) as mainArtistId,
               alb.id as currentAlbumId,
               alb.name as albumName
        FROM track_metadata t
        LEFT JOIN track_artists ta ON t.id = ta.track_id
        LEFT JOIN artists ar ON ta.artist_id = ar.id
        LEFT JOIN album_tracks at ON t.id = at.track_id AND at.is_primary = 1
        LEFT JOIN albums alb ON at.album_id = alb.id
        WHERE t.id = ?
        GROUP BY t.id
      `).get(id);

      if (!track) return reply.code(404).send({ error: 'Track not found' });

      const searchTitle = customTitle || track.title;
      const searchArtist = customArtist || track.artistName;

      const info = await lastfmService.getTrackInfo(searchArtist, searchTitle);
      if (!info) return reply.code(404).send({ error: 'Last.fm에서 트랙 정보를 찾을 수 없습니다.' });

      if (mode === 'preview') {
        return { success: true, mode, local: track, external: info };
      }

      // 💉 비동기 이미지 처리를 위해 트랜잭션 밖으로 앨범 ID를 빼냅니다.
      let targetAlbumIdForDownload = null;

      const transaction = db.transaction(() => {
        const finalTags = mergeTags(track.tags, info.tags, mode);
        db.prepare('UPDATE track_metadata SET tags = ?, title = COALESCE(?, title) WHERE id = ?')
          .run(finalTags ? JSON.stringify(finalTags) : null, info.title, id);
        
        if (info.artist && track.mainArtistId) {
          db.prepare('UPDATE artists SET name = ? WHERE id = ?').run(info.artist, track.mainArtistId);
          console.log(`🎤 [Enrich Track] 아티스트 명칭 교정 완료: ${info.artist}`);
        }

        if (info.albumName && track.mainArtistId) {
          let targetAlbum = db.prepare('SELECT id FROM albums WHERE name = ? AND main_artist_id = ?').get(info.albumName, track.mainArtistId);
          let targetAlbumId;

          if (targetAlbum) {
             targetAlbumId = targetAlbum.id;
          } else {
             targetAlbumId = ulid();
             db.prepare('INSERT INTO albums (id, name, main_artist_id) VALUES (?, ?, ?)').run(targetAlbumId, info.albumName, track.mainArtistId);
             console.log(`✨ [Enrich Track] 새 앨범 방 생성 완료: ${info.albumName}`);
          }

          targetAlbumIdForDownload = targetAlbumId;

          if (targetAlbumId !== track.currentAlbumId) {
            if (track.currentAlbumId) {
              db.prepare('UPDATE album_tracks SET album_id = ? WHERE track_id = ? AND album_id = ? AND is_primary = 1').run(targetAlbumId, id, track.currentAlbumId);
            } else {
              db.prepare('INSERT INTO album_tracks (id, album_id, track_id, is_primary) VALUES (?, ?, ?, 1)').run(ulid(), targetAlbumId, id);
            }

            if (track.currentAlbumId) {
              const remaining = db.prepare('SELECT count(*) as cnt FROM album_tracks WHERE album_id = ?').get(track.currentAlbumId);
              if (remaining.cnt === 0) {
                 db.prepare('DELETE FROM albums WHERE id = ?').run(track.currentAlbumId);
                 console.log(`🧹 [Enrich Track] 가비지 컬렉션: 빈 앨범 삭제 완료`);
              }
            }
          }
        }
      });
      
      transaction(); // 동기식 DB 작업 완료!

      // 💉 [추가/수정] 트랜잭션이 안전하게 닫힌 후 비동기 이미지 다운로드 시작!
      if (targetAlbumIdForDownload && info.imageUrl) {
        try {
          // Last.fm 이미지 URL에서 확장자 추출 (없으면 기본 .jpg)
          const ext = info.imageUrl.match(/\.(png|jpe?g|gif)$/i)?.[0] || '.jpg';
          const filename = `${targetAlbumIdForDownload}${ext}`;
          
          console.log(`⬇️ [Enrich Track] 커버 이미지 다운로드 시도: ${filename}`);
          const isDownloaded = await downloadImage(info.imageUrl, filename);
          
          if (isDownloaded) {
            // 💉 수정됨: has_cover = 1 대신 실제 추출한 확장자(ext)를 cover_type에 업데이트합니다.
            db.prepare('UPDATE albums SET cover_type = ? WHERE id = ?').run(ext, targetAlbumIdForDownload);
            console.log(`🖼️ [Enrich Track] 커버 이미지 적용 완료 (cover_type: ${ext})`);
          }
        } catch (downloadErr) {
          console.error(`❌ [Enrich Track] 이미지 다운로드 중 예외 발생:`, downloadErr.message);
        }
      }

      console.log(`🎉 [Enrich Track] 처리 완료!\n`);
      return { success: true, mode, data: info };
    } catch (err) {
      console.error(`❌ [Enrich Track] 서버 에러 발생:`, err);
      return reply.code(500).send({ error: '트랙 강화 중 서버 오류 발생' });
    }
  });

  // =====================================================================
  // 4. 앨범 수동 검색 (Search Picker UI 용도)
  // =====================================================================
  fastify.get('/api/search/external/album', async (request, reply) => {
    // ... 생략 없이 기존 코드 유지 ...
    const { query } = request.query;
    if (!query) return reply.code(400).send({ error: '검색어(query)가 필요합니다.' });

    try {
      const API_KEY = process.env.LASTFM_API_KEY;
      const url = `http://ws.audioscrobbler.com/2.0/?method=album.search&album=${encodeURIComponent(query)}&api_key=${API_KEY}&format=json`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.error || !data.results?.albummatches?.album) {
        return [];
      }

      const albums = data.results.albummatches.album.map(a => ({
        name: a.name,
        artist: a.artist,
        imageUrl: a.image?.find(img => img.size === 'extralarge')?.['#text'] || a.image?.[a.image.length - 1]?.['#text'],
        mbid: a.mbid
      }));

      return albums;
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: '외부 앨범 검색 중 오류가 발생했습니다.' });
    }
  });
}