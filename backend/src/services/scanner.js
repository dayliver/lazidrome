import chokidar from 'chokidar';
import path from 'node:path';
import fs from 'node:fs';
import { ulid } from 'ulid';
import crypto from 'node:crypto';
import * as mm from 'music-metadata';
import db from '../db.js';
import sharp from 'sharp';
import { ROLES } from '../constants/roles.js';
import { splitArtistNames } from '../lib/artistTags.js';

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
      const metadata = await mm.parseFile(filePath);
      
      const title = metadata.common.title || path.basename(filePath, ext);
      const duration = metadata.format.duration || 0;
      const year = metadata.common.year || null;
      const genre = metadata.common.genre?.[0] || null;
      const albumName = metadata.common.album;
      const trackNo = metadata.common.track?.no || null;
      const discNo = metadata.common.disk?.no || null;

      const trackArtistNames = splitArtistNames(metadata.common.artist);
      const albumArtistTagNames = splitArtistNames(metadata.common.albumartist);
      const composerNames = splitArtistNames(metadata.common.composer);
      const albumNamesForAlbum = splitArtistNames(
        metadata.common.albumartist || metadata.common.artist
      );

      const maskByName = new Map();
      const addRoleBits = (name, bits) => {
        const k = name.trim();
        if (!k) return;
        maskByName.set(k, (maskByName.get(k) ?? 0) | bits);
      };
      for (let i = 0; i < trackArtistNames.length; i++) {
        addRoleBits(
          trackArtistNames[i],
          i === 0 ? ROLES.PERFORMER : ROLES.FEATURING
        );
      }
      for (const n of albumArtistTagNames) addRoleBits(n, ROLES.PERFORMER);
      for (const n of composerNames) addRoleBits(n, ROLES.COMPOSER);

      let albumId = null;

      const transaction = db.transaction(() => {
        const existingByHash = db.prepare('SELECT id, path FROM track_filedata WHERE id = ?').get(newHash);
        const existingByPath = db.prepare('SELECT id as hash FROM track_filedata WHERE path = ?').get(filePath);

        if (existingByHash) {
          if (existingByHash.path !== filePath) {
            db.prepare('UPDATE track_filedata SET path = ? WHERE id = ?').run(filePath, newHash);
          }
          return; 
        }

        // 💡 헬퍼 함수: 아티스트 배열을 받아 DB 확인 후 ID 배열 반환
        const getOrCreateArtistIds = (names) => {
          return names.map(name => {
            let artist = db.prepare('SELECT id FROM artists WHERE name = ?').get(name);
            if (!artist) {
              const newId = ulid();
              db.prepare('INSERT INTO artists (id, name) VALUES (?, ?)').run(newId, name);
              return newId;
            }
            return artist.id;
          });
        };

        const albumArtistIds = getOrCreateArtistIds(albumNamesForAlbum);

        // 💡 2. 앨범 찾기 (다대다 구조 반영)
        const safeAlbumName = albumName || `Unknown Album (${title})`;
        
        // 동일한 이름을 가진 앨범 후보들을 모두 가져옴
        const candidateAlbums = db.prepare('SELECT id FROM albums WHERE name = ?').all(safeAlbumName);
        
        for (const row of candidateAlbums) {
          // 해당 앨범에 속한 아티스트 목록 가져오기
          const existingArtists = db.prepare('SELECT artist_id FROM album_artists WHERE album_id = ?').all(row.id).map(a => a.artist_id);
          
          // 두 아티스트 그룹(배열)이 동일한지 검사
          const sortedA = [...albumArtistIds].sort().join(',');
          const sortedB = [...existingArtists].sort().join(',');

          if (sortedA === sortedB) {
            albumId = row.id;
            break; // 완벽히 일치하는 앨범을 찾음!
          }
        }

        // 일치하는 앨범이 없다면 새로 생성
        if (!albumId) {
          albumId = ulid();
          db.prepare('INSERT INTO albums (id, name, year) VALUES (?, ?, ?)').run(albumId, safeAlbumName, year);
          
          // album_artists 교차 테이블에 관계 생성
          const insertAlbumArtist = db.prepare('INSERT INTO album_artists (album_id, artist_id) VALUES (?, ?)');
          for (const aId of albumArtistIds) {
            insertAlbumArtist.run(albumId, aId);
          }
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
          const insertTrackArtist = db.prepare(
            'INSERT INTO track_artists (track_id, artist_id, role_mask) VALUES (?, ?, ?)'
          );
          for (const [name, mask] of maskByName) {
            if (!mask) continue;
            const artistId = getOrCreateArtistIds([name])[0];
            insertTrackArtist.run(currentTrackId, artistId, mask);
          }

          const existingLink = db.prepare('SELECT id FROM album_tracks WHERE album_id = ? AND track_id = ?').get(albumId, currentTrackId);
          if (!existingLink) {
            const primaryCheck = db.prepare('SELECT count(*) as cnt FROM album_tracks WHERE track_id = ? AND is_primary = 1').get(currentTrackId);
            const isPrimary = primaryCheck.cnt === 0 ? 1 : 0;
            db.prepare('INSERT INTO album_tracks (id, album_id, track_id, is_primary, track_number, disc_number) VALUES (?, ?, ?, ?, ?, ?)').run(ulid(), albumId, currentTrackId, isPrimary, trackNo, discNo);
          }
        }
      });

      transaction();

      if (albumId && metadata.common.picture && metadata.common.picture.length > 0) {
        const albumCover = db.prepare('SELECT cover_type FROM albums WHERE id = ?').get(albumId);
        
        if (!albumCover?.cover_type) {
          const pic = metadata.common.picture[0];
          const fileName = `${albumId}.jpg`;
          fs.mkdirSync(path.join(IMAGES_PATH, 'albums'), { recursive: true });
          const targetPath = path.join(IMAGES_PATH, 'albums', fileName);

          try {
            await sharp(pic.data)
              .resize(600, 600, { fit: 'cover', position: 'center' })
              .jpeg({ quality: 85 })
              .toFile(targetPath);

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