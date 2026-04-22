import { getDB } from '../db.js';
import { lastfmService } from '../services/lastfmService.js';
import { ulid } from 'ulid';
import { downloadImage } from '../lib/downloader.js'; 
import path from 'node:path';
import fs from 'node:fs';       
import sharp from 'sharp';      

export default async function enrichmentRoutes(fastify) {
  const db = getDB();

  const mergeTags = (localTags, externalTags, mode) => {
    if (mode === 'force') return externalTags;
    if (mode === 'fill' && (!localTags || localTags.length === 0)) return externalTags;
    
    const localArr = localTags ? JSON.parse(localTags) : [];
    const merged = [...new Set([...localArr, ...externalTags])];
    return merged.length > 0 ? merged : null;
  };

  // =====================================================================
  // 1. 아티스트 정보 강화 (POST - Preview)
  // =====================================================================
  fastify.post('/api/enrich/artist/:id', async (request, reply) => {
    const { id } = request.params;
    const mode = request.query.mode || 'preview'; 
    
    // 💡 1. 프론트엔드가 쿼리로 보낸 검색어(title 또는 artist)를 캐치합니다!
    const customSearchName = request.query.title || request.query.artist;

    try {
      const artist = db.prepare('SELECT id, name, tags, mbid FROM artists WHERE id = ?').get(id);
      if (!artist) return reply.code(404).send({ error: 'Artist not found' });

      // 💡 2. 커스텀 검색어가 있으면 그것을 쓰고, 없으면 DB의 이름을 씁니다.
      const searchTarget = customSearchName || artist.name;
      const info = await lastfmService.getArtistInfo(searchTarget);
      
      if (!info) {
        if (mode === 'preview') {
          const localBio = db.prepare('SELECT biography FROM artist_biographies WHERE artist_id = ? AND language = ?').get(id, 'en');
          return { success: true, mode, local: { ...artist, bio: localBio?.biography }, external: null };
        }
        return reply.code(404).send({ error: 'Last.fm에서 정보를 찾을 수 없습니다.' });
      }

      if (mode === 'preview') {
        const localBio = db.prepare('SELECT biography FROM artist_biographies WHERE artist_id = ? AND language = ?').get(id, 'en');
        return { success: true, mode, local: { ...artist, bio: localBio?.biography }, external: info };
      }

      // ... (아래 DB 트랜잭션 로직은 기존과 동일) ...
      const transaction = db.transaction(() => {
        const finalTags = mergeTags(artist.tags, info.tags, mode);
        db.prepare('UPDATE artists SET tags = ?, mbid = COALESCE(?, mbid) WHERE id = ?').run(finalTags ? JSON.stringify(finalTags) : null, info.mbid || null, id);
        if (info.bio && (mode === 'force' || mode === 'fill')) {
          db.prepare(`INSERT INTO artist_biographies (artist_id, language, biography) VALUES (?, 'en', ?) ON CONFLICT(artist_id, language) DO UPDATE SET biography = excluded.biography`).run(id, info.bio);
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
  // 💡 [신규] 2. 아티스트 수동 편집 (PATCH - Multipart & Bio 스키마 대응)
  // =====================================================================
  fastify.patch('/api/enrich/artist/:id', async (request, reply) => {
    const { id } = request.params;
    const isMultipart = request.headers['content-type']?.includes('multipart');
    
    let data = {};
    let fileBuffer = null;

    try {
      if (isMultipart) {
        const parts = request.parts();
        for await (const part of parts) {
          if (part.type === 'file' && part.fieldname === 'newCoverFile') {
            fileBuffer = await part.toBuffer();
          } else {
            data[part.fieldname] = part.value;
          }
        }
        if (data.tags) data.tags = JSON.parse(data.tags);
      } else {
        data = request.body;
      }

      const { title, biography, tags, mbid, newCoverUrl } = data;

      const transaction = db.transaction(() => {
        // 1. 아티스트 기본 정보 (artists 테이블) 업데이트
        db.prepare(`
          UPDATE artists 
          SET name = COALESCE(?, name), 
              tags = ?, 
              mbid = ? 
          WHERE id = ?
        `).run(title, tags ? JSON.stringify(tags) : null, mbid || null, id);

        // 2. 소개글 (artist_biographies 테이블) 업데이트
        if (biography !== undefined) {
          if (biography && biography.trim() !== '') {
            db.prepare(`
              INSERT INTO artist_biographies (artist_id, language, biography) 
              VALUES (?, 'en', ?) 
              ON CONFLICT(artist_id, language) DO UPDATE SET biography = excluded.biography
            `).run(id, biography.trim());
          } else {
            // 내용이 비워졌다면 DB에서도 삭제
            db.prepare(`DELETE FROM artist_biographies WHERE artist_id = ? AND language = 'en'`).run(id);
          }
        }
      });
      
      transaction();

      // 3. 프로필 이미지 처리
      if (newCoverUrl) {
        const ext = newCoverUrl.match(/\.(png|jpe?g|gif)$/i)?.[0] || '.jpg';
        const filename = `${id}${ext}`; // 💡 접두사 제거
        if (await downloadImage(newCoverUrl, filename)) {
          // 아티스트 테이블의 cover_type 컬럼 업데이트
          db.prepare('UPDATE artists SET cover_type = ? WHERE id = ?').run(ext, id);
        }
      } else if (fileBuffer) {
        const ext = '.jpg';
        const artistsDir = path.join(process.env.IMAGES_PATH || './storage/images');
        if (!fs.existsSync(artistsDir)) fs.mkdirSync(artistsDir, { recursive: true });
        
        // 💡 접두사 제거
        await sharp(fileBuffer)
          .resize(800, 800, { fit: 'cover' })
          .jpeg({ quality: 90 })
          .toFile(path.join(artistsDir, `${id}${ext}`));
        
        // 아티스트 테이블의 cover_type 컬럼 업데이트
        db.prepare('UPDATE artists SET cover_type = ? WHERE id = ?').run(ext, id);
      }

      // 💡 4. 업데이트된 최신 데이터 반환 (프론트엔드 Local Mutation 용)
      const updatedArtist = db.prepare('SELECT id, name, cover_type, tags, mbid FROM artists WHERE id = ?').get(id);
      return { success: true, data: updatedArtist };
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: err.message });
    }
  });

  // =====================================================================
  // 3. 앨범 정보 강화 (POST - Preview)
  // =====================================================================
  fastify.post('/api/enrich/album/:id', async (request, reply) => {
    const { id } = request.params;
    const mode = request.query.mode || 'preview';

    try {
      const album = db.prepare(`
        SELECT 
          a.id, a.name, a.year, a.mbid, a.cover_type, 
          (
            SELECT GROUP_CONCAT(ar.name, ', ') 
            FROM album_artists aa 
            JOIN artists ar ON aa.artist_id = ar.id 
            WHERE aa.album_id = a.id
          ) as artistName
        FROM albums a
        WHERE a.id = ?
      `).get(id);

      if (!album) return reply.code(404).send({ error: 'Album not found' });

      const tracks = db.prepare(`
        SELECT 
          at.track_id, at.disc_number, at.track_number, at.is_primary,
          tm.title,
          (SELECT group_concat(name, ', ') FROM artists JOIN track_artists ON artists.id = artist_id WHERE track_id = tm.id) as artist
        FROM album_tracks at
        JOIN track_metadata tm ON at.track_id = tm.id
        WHERE at.album_id = ?
        ORDER BY at.disc_number, at.track_number
      `).all(id);

      const albumArtists = db.prepare(`
        SELECT ar.id, ar.name
        FROM album_artists aa
        JOIN artists ar ON aa.artist_id = ar.id
        WHERE aa.album_id = ?
      `).all(id);

      const cleanAlbumName = album.name.replace(/\s*\([^)]*\)/g, '').trim();
      const searchArtistName = album.artistName ? album.artistName.split(',')[0] : '';
      const info = await lastfmService.getAlbumInfo(searchArtistName, cleanAlbumName);
      
      const localData = { ...album, tracks, albumArtists };

      if (!info) {
        if (mode === 'preview') return { success: true, mode, local: localData, external: null };
        return reply.code(404).send({ error: 'Last.fm에서 앨범 정보를 찾을 수 없습니다.' });
      }

      if (mode === 'preview') return { success: true, mode, local: localData, external: info };

      const releaseYear = info.releaseDate ? parseInt(info.releaseDate.match(/\d{4}/)?.[0], 10) : null;
      const finalYear = (mode === 'fill' && album.year) ? album.year : (releaseYear || album.year);
      db.prepare('UPDATE albums SET year = ?, mbid = COALESCE(?, mbid) WHERE id = ?').run(finalYear, info.mbid || null, id);
      return { success: true, mode, data: info };
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: '앨범 강화 중 서버 오류 발생' });
    }
  });

  // =====================================================================
  // 4. 앨범 수동 편집 (PATCH)
  // =====================================================================
  fastify.patch('/api/enrich/album/:id', async (request, reply) => {
    const { id } = request.params;
    const isMultipart = request.headers['content-type']?.includes('multipart');
    
    let data = {};
    let fileBuffer = null;

    try {
      if (isMultipart) {
        const parts = request.parts();
        for await (const part of parts) {
          if (part.type === 'file' && part.fieldname === 'newCoverFile') {
            fileBuffer = await part.toBuffer();
          } else {
            data[part.fieldname] = part.value;
          }
        }
        
        if (data.tags) data.tags = JSON.parse(data.tags);
        if (data.year) data.year = parseInt(data.year, 10);
        if (data.albumArtists) data.albumArtists = JSON.parse(data.albumArtists);
        if (data.albumTracks) data.albumTracks = JSON.parse(data.albumTracks);
      } else {
        data = request.body;
      }

      const { title, year, mbid, albumArtists, albumTracks, newCoverUrl } = data;

      const transaction = db.transaction(() => {
        db.prepare(`UPDATE albums SET name = COALESCE(?, name), year = ?, mbid = ? WHERE id = ?`)
          .run(title, year || null, mbid || null, id);

        if (Array.isArray(albumArtists)) {
          db.prepare('DELETE FROM album_artists WHERE album_id = ?').run(id);
          const insertAA = db.prepare('INSERT INTO album_artists (album_id, artist_id) VALUES (?, ?)');
          const insertArtist = db.prepare('INSERT INTO artists (id, name) VALUES (?, ?)');

          for (const art of albumArtists) {
            let aId = art.id;
            if (!aId && art.name) {
              const existing = db.prepare('SELECT id FROM artists WHERE name = ?').get(art.name);
              if (existing) {
                aId = existing.id;
              } else {
                aId = ulid();
                insertArtist.run(aId, art.name);
              }
            }
            if (aId) insertAA.run(id, aId);
          }
        }

        if (Array.isArray(albumTracks)) {
          db.prepare('DELETE FROM album_tracks WHERE album_id = ?').run(id);
          const insertTrackStmt = db.prepare(`
            INSERT INTO album_tracks (id, album_id, track_id, is_primary, disc_number, track_number)
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          for (const track of albumTracks) {
            insertTrackStmt.run(
              ulid(), id, track.track_id, track.is_primary ? 1 : 0, track.disc_number || 1, track.track_number || null
            );
          }
        }
      });

      transaction();

      if (newCoverUrl) {
        const ext = newCoverUrl.match(/\.(png|jpe?g|gif)$/i)?.[0] || '.jpg';
        const filename = `${id}${ext}`;
        if (await downloadImage(newCoverUrl, filename)) {
          db.prepare('UPDATE albums SET cover_type = ? WHERE id = ?').run(ext, id);
        }
      } else if (fileBuffer) {
        const ext = '.jpg'; 
        const coversDir = path.join(process.env.IMAGES_PATH || './storage/images'); 
        if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true });
        
        await sharp(fileBuffer).resize(800, 800, { fit: 'cover' }).jpeg({ quality: 90 }).toFile(path.join(coversDir, `${id}${ext}`));
        db.prepare('UPDATE albums SET cover_type = ? WHERE id = ?').run(ext, id);
      }

      // 💡 4. 업데이트된 최신 데이터 반환
      const updatedAlbum = db.prepare('SELECT id, name, year, cover_type, mbid FROM albums WHERE id = ?').get(id);
      return { success: true, data: updatedAlbum };
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: err.message });
    }
  });

  // =====================================================================
  // 5. 트랙 수동 편집 (PATCH)
  // =====================================================================
  fastify.patch('/api/enrich/track/:id', async (request, reply) => {
    const { id } = request.params;
    const isMultipart = request.headers['content-type']?.includes('multipart');
    
    let data = {};
    let fileBuffer = null;

    try {
      if (isMultipart) {
        const parts = request.parts();
        for await (const part of parts) {
          if (part.type === 'file' && part.fieldname === 'newCoverFile') {
            fileBuffer = await part.toBuffer();
          } else {
            data[part.fieldname] = part.value;
          }
        }
        if (data.tags) data.tags = JSON.parse(data.tags);
        if (data.artists) data.artists = JSON.parse(data.artists);
        if (data.year) data.year = parseInt(data.year, 10);
      } else {
        data = request.body;
      }

      const { title, year, genre, tags, artists, albumId, albumName, newCoverUrl } = data;
      let targetAlbumId = albumId;

      const transaction = db.transaction(() => {
        db.prepare(`
          UPDATE track_metadata 
          SET title = COALESCE(?, title),
              genre = COALESCE(?, genre),
              tags = COALESCE(?, tags)
          WHERE id = ?
        `).run(title, genre, tags ? JSON.stringify(tags) : null, id);

        if (!targetAlbumId && albumName) {
          const existing = db.prepare('SELECT id FROM albums WHERE name = ?').get(albumName);
          if (existing) {
            targetAlbumId = existing.id;
          } else {
            targetAlbumId = ulid();
            const mainArtist = db.prepare('SELECT artist_id FROM track_artists WHERE track_id = ? LIMIT 1').get(id);
            db.prepare('INSERT INTO albums (id, name, main_artist_id, year) VALUES (?, ?, ?, ?)').run(targetAlbumId, albumName, mainArtist?.artist_id, year);
          }
        }

        if (targetAlbumId) {
          db.prepare(`UPDATE album_tracks SET album_id = ? WHERE track_id = ? AND is_primary = 1`).run(targetAlbumId, id);
          if (year !== undefined) {
            db.prepare('UPDATE albums SET year = ? WHERE id = ?').run(year, targetAlbumId);
          }
        }

        if (Array.isArray(artists)) {
          db.prepare('DELETE FROM track_artists WHERE track_id = ?').run(id);
          const insertArtistStmt = db.prepare('INSERT INTO artists (id, name) VALUES (?, ?)');
          const linkArtistStmt = db.prepare('INSERT INTO track_artists (track_id, artist_id, role_mask) VALUES (?, ?, ?)');

          for (const reqArtist of artists) {
            let artistId = reqArtist.id;
            if (!artistId && reqArtist.name) {
              const existing = db.prepare('SELECT id FROM artists WHERE name = ?').get(reqArtist.name);
              if (existing) {
                artistId = existing.id;
              } else {
                artistId = ulid();
                insertArtistStmt.run(artistId, reqArtist.name);
              }
            }
            if (artistId) linkArtistStmt.run(id, artistId, reqArtist.role_mask || 1);
          }
        }
      });

      transaction();

      if (targetAlbumId) {
        try {
          if (newCoverUrl) {
            const ext = newCoverUrl.match(/\.(png|jpe?g|gif)$/i)?.[0] || '.jpg';
            const filename = `${targetAlbumId}${ext}`;
            if (await downloadImage(newCoverUrl, filename)) {
              db.prepare('UPDATE albums SET cover_type = ? WHERE id = ?').run(ext, targetAlbumId);
            }
          } else if (fileBuffer) {
            const ext = '.jpg'; 
            const coversDir = path.join(process.env.IMAGES_PATH || './storage/images'); 
            if (!fs.existsSync(coversDir)) fs.mkdirSync(coversDir, { recursive: true });
            
            await sharp(fileBuffer).resize(800, 800, { fit: 'cover' }).jpeg({ quality: 90 }).toFile(path.join(coversDir, `${targetAlbumId}${ext}`));
            db.prepare('UPDATE albums SET cover_type = ? WHERE id = ?').run(ext, targetAlbumId);
          }
        } catch (imgError) {
          console.error('❌ 커버 저장 중 에러:', imgError);
        }
      }

      // 💡 4. 업데이트된 최신 데이터 반환 (트랙 + 앨범 정보 병합)
      const updatedTrack = db.prepare('SELECT id, title, genre, tags FROM track_metadata WHERE id = ?').get(id);
      let albumInfo = {};
      if (targetAlbumId) {
        albumInfo = db.prepare('SELECT id as albumId, name as albumName, cover_type as albumCoverType FROM albums WHERE id = ?').get(targetAlbumId) || {};
      }
      return { success: true, data: { ...updatedTrack, ...albumInfo } };
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: err.message });
    }
  });

  // =====================================================================
  // 6. 트랙 정보 강화 (POST - Preview)
  // =====================================================================
  fastify.post('/api/enrich/track/:id', async (request, reply) => {
    const { id } = request.params;
    const mode = request.query.mode || 'preview';
    const customTitle = request.query.title;
    const customArtist = request.query.artist;

    try {
      const track = db.prepare(`
        SELECT 
          t.id, t.title, t.tags, 
          alb.year as year,
          alb.id as currentAlbumId,
          alb.name as albumName,
          alb.cover_type as albumCoverType,
          (
            SELECT json_group_array(
              json_object('id', a.id, 'name', a.name, 'role_mask', ta.role_mask)
            )
            FROM track_artists ta
            JOIN artists a ON ta.artist_id = a.id
            WHERE ta.track_id = t.id
          ) as artists_json
        FROM track_metadata t
        LEFT JOIN album_tracks at ON t.id = at.track_id AND at.is_primary = 1
        LEFT JOIN albums alb ON at.album_id = alb.id
        WHERE t.id = ?
      `).get(id);

      if (!track) return reply.code(404).send({ error: 'Track not found' });

      track.artists = JSON.parse(track.artists_json || '[]');
      delete track.artists_json; 

      const searchTitle = customTitle || track.title;
      const searchArtist = customArtist || (track.artists.length > 0 ? track.artists[0].name : '');

      const info = await lastfmService.getTrackInfo(searchArtist, searchTitle);
      
      if (!info) {
        if (mode === 'preview') return { success: true, mode, local: track, external: null };
        return reply.code(404).send({ error: 'Last.fm에서 트랙 정보를 찾을 수 없습니다.' });
      }

      if (mode === 'preview') return { success: true, mode, local: track, external: info };

      return { success: true, mode, data: info };
    } catch (err) {
      console.error(`❌ 서버 에러 발생:`, err);
      return reply.code(500).send({ error: '트랙 강화 중 서버 오류 발생' });
    }
  });

  // =====================================================================
  // 7. 앨범 수동 검색 (Last.fm)
  // =====================================================================
  fastify.get('/api/search/external/album', async (request, reply) => {
    const { query } = request.query;
    if (!query) return reply.code(400).send({ error: '검색어(query)가 필요합니다.' });

    try {
      const API_KEY = process.env.LASTFM_API_KEY;
      const url = `http://ws.audioscrobbler.com/2.0/?method=album.search&album=${encodeURIComponent(query)}&api_key=${API_KEY}&format=json`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.error || !data.results?.albummatches?.album) return [];

      return data.results.albummatches.album.map(a => ({
        name: a.name,
        artist: a.artist,
        imageUrl: a.image?.find(img => img.size === 'extralarge')?.['#text'] || a.image?.[a.image.length - 1]?.['#text'],
        mbid: a.mbid
      }));
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: '외부 앨범 검색 중 오류' });
    }
  });
}