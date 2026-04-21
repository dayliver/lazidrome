import chokidar from 'chokidar';
import path from 'node:path';
import fs from 'node:fs';
import { ulid } from 'ulid';
import crypto from 'node:crypto';
import * as mm from 'music-metadata';
import db from '../db.js';
// 💉 1. sharp 라이브러리 추가
import sharp from 'sharp';

/**
 * 파일의 SHA256 해시를 계산합니다.
 */
function getFileHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

export function startScanner(watchPath) {
  const watcher = chokidar.watch(watchPath, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: false
  });

  const IMAGES_PATH = process.env.IMAGES_PATH || './storage/images';

  console.log(`🔍 스캐너 가동: ${watchPath} 감시 중...`);

  const handleFile = async (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    if (!['.mp3', '.flac', '.wav', '.m4a', '.ogg', '.aac'].includes(ext)) return;

    try {
      const newHash = getFileHash(filePath);
      const stats = fs.statSync(filePath);
      // 💉 내장 이미지 추출을 위해 metadata 분석
      const metadata = await mm.parseFile(filePath);
      
      const title = metadata.common.title || path.basename(filePath, ext);
      const duration = metadata.format.duration || 0;
      const year = metadata.common.year || null;
      const genre = metadata.common.genre?.[0] || null;
      const albumName = metadata.common.album;
      const trackNo = metadata.common.track?.no || null;
      const discNo = metadata.common.disk?.no || null;
      
      const artistRaw = metadata.common.artist || 'Unknown Artist';
      const artistNames = artistRaw.split(/[,/;]|\s&\s/).map(s => s.trim()).filter(Boolean);

      let albumId = null;

      // 2. DB 트랜잭션 (메타데이터 저장)
      const transaction = db.transaction(() => {
        const existingByHash = db.prepare('SELECT id, path FROM track_filedata WHERE id = ?').get(newHash);
        const existingByPath = db.prepare('SELECT id as hash FROM track_filedata WHERE path = ?').get(filePath);

        if (existingByHash) {
          if (existingByHash.path !== filePath) {
            db.prepare('UPDATE track_filedata SET path = ? WHERE id = ?').run(filePath, newHash);
          }
          return; 
        }

        const artistIds = artistNames.map(name => {
          let artist = db.prepare('SELECT id FROM artists WHERE name = ?').get(name);
          if (!artist) {
            const newId = ulid();
            db.prepare('INSERT INTO artists (id, name) VALUES (?, ?)').run(newId, name);
            return newId;
          }
          return artist.id;
        });

        const mainArtistId = artistIds[0];
        const safeAlbumName = albumName || `Unknown Album (${title})`;

        let album = db.prepare('SELECT id FROM albums WHERE name = ? AND main_artist_id = ?').get(safeAlbumName, mainArtistId);
        
        if (!album) {
          albumId = ulid();
          db.prepare('INSERT INTO albums (id, name, main_artist_id, year) VALUES (?, ?, ?, ?)').run(albumId, safeAlbumName, mainArtistId, year);
        } else {
          albumId = album.id;
        }

        let currentTrackId;

        if (existingByPath) {
          const metaRecord = db.prepare('SELECT id FROM track_metadata WHERE file_id = ?').get(existingByPath.hash);
          currentTrackId = metaRecord?.id;
          
          if (currentTrackId) {
            db.prepare('DELETE FROM track_filedata WHERE id = ?').run(existingByPath.hash);
            db.prepare(`
              INSERT INTO track_filedata (id, path, size, duration, bitrate, format, source)
              VALUES (?, ?, ?, ?, ?, ?, 'scan')
            `).run(newHash, filePath, stats.size, duration, Math.round(metadata.format.bitrate / 1000), metadata.format.container);

            db.prepare('UPDATE track_metadata SET file_id = ?, title = ?, year = ?, genre = ? WHERE id = ?').run(newHash, title, year, genre, currentTrackId);
            db.prepare('DELETE FROM track_artists WHERE track_id = ?').run(currentTrackId);
          }
        } else {
          currentTrackId = ulid();
          db.prepare(`
            INSERT INTO track_filedata (id, path, size, duration, bitrate, format, source)
            VALUES (?, ?, ?, ?, ?, ?, 'scan')
          `).run(newHash, filePath, stats.size, duration, Math.round(metadata.format.bitrate / 1000), metadata.format.container);

          db.prepare('INSERT INTO track_metadata (id, file_id, title, year, genre) VALUES (?, ?, ?, ?, ?)').run(currentTrackId, newHash, title, year, genre);
        }

        if (currentTrackId) {
          artistIds.forEach((id, index) => {
            const role = index === 0 ? 1 : 16;
            db.prepare('INSERT OR IGNORE INTO track_artists (track_id, artist_id, role_mask) VALUES (?, ?, ?)').run(currentTrackId, id, role);
          });

          const existingLink = db.prepare('SELECT id FROM album_tracks WHERE album_id = ? AND track_id = ?').get(albumId, currentTrackId);
          if (!existingLink) {
            const primaryCheck = db.prepare('SELECT count(*) as cnt FROM album_tracks WHERE track_id = ? AND is_primary = 1').get(currentTrackId);
            const isPrimary = primaryCheck.cnt === 0 ? 1 : 0;
            db.prepare('INSERT INTO album_tracks (id, album_id, track_id, is_primary, track_number, disc_number) VALUES (?, ?, ?, ?, ?, ?)').run(ulid(), albumId, currentTrackId, isPrimary, trackNo, discNo);
          }
        }
      });

      transaction();

      // 💉 3. 이미지 처리 (트랜잭션 완료 후 비동기 진행)
      if (albumId && metadata.common.picture && metadata.common.picture.length > 0) {
        const albumCover = db.prepare('SELECT cover_type FROM albums WHERE id = ?').get(albumId);
        
        // 이미 커버가 등록되어 있다면(Last.fm 등에서 이미 가져왔다면) 넘어갑니다.
        if (!albumCover?.cover_type) {
          const pic = metadata.common.picture[0];
          const fileName = `${albumId}.jpg`;
          const targetPath = path.join(IMAGES_PATH, fileName);

          try {
            await sharp(pic.data)
              .resize(600, 600, { // 1:1 비율로 크롭 및 리사이징
                fit: 'cover',
                position: 'center'
              })
              .jpeg({ quality: 85 }) // 용량을 위해 JPEG로 압축 저장
              .toFile(targetPath);

            // DB에 확장자 정보 업데이트
            db.prepare('UPDATE albums SET cover_type = ? WHERE id = ?').run('.jpg', albumId);
            console.log(`🖼️ [Scanner] 내장 커버 추출 완료: ${albumId}.jpg`);
          } catch (sharpErr) {
            console.error(`❌ [Scanner] 커버 처리 중 오류:`, sharpErr.message);
          }
        }
      }

    } catch (err) {
      if (err.code !== 'EBUSY' && err.code !== 'ENOENT') {
        console.error(`❌ 스캔 오류 (${filePath}):`, err.message);
      }
    }
  };

  watcher.on('add', handleFile);
  watcher.on('change', handleFile);
}