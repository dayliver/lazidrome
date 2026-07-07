import chokidar from 'chokidar';
import path from 'node:path';
import fs from 'node:fs';
import { ulid } from 'ulid';
import * as mm from 'music-metadata';
import db from '../db.js';
import sharp from 'sharp';
import { ROLES } from '../constants/roles.js';
import { splitArtistNames } from '../lib/artistTags.js';
import { resolveScanTrackMeta } from '../lib/resolveScanTrackMeta.js';
import { sha256FileStream } from '../lib/fileHash.js';
import { cleanupOrphans } from '../lib/orphanCleanup.js';
import { bumpLibraryRevision } from '../lib/libraryRevision.js';

/** 스캔·감시 제외 폴더명 (경로 어디에든 동일하게 적용) */
export const SCAN_EXCLUDED_DIR = '_excluded';

/**
 * `/music/_excluded`, `/music/Artist/_excluded/Album/...` 등
 * 경로 세그먼트에 `_excluded`가 있으면 true.
 */
export function isExcludedScanPath(filePath) {
  if (!filePath) return false;
  const parts = path.normalize(String(filePath)).split(path.sep);
  return parts.includes(SCAN_EXCLUDED_DIR);
}

export function startScanner(watchPath) {
  const watcher = chokidar.watch(watchPath, {
    ignored: (p) => isExcludedScanPath(p) || /(^|[\/\\])\../.test(p),
    persistent: true,
    ignoreInitial: false,
    // 대용량 파일 복사 중간(add/change) 이벤트를 줄여 부분 파일 파싱을 방지
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100,
    }
  });

  const IMAGES_PATH = process.env.IMAGES_PATH || './storage/images';
  console.log(`🔍 스캐너 가동: ${watchPath} 감시 중...`);

  const handleFile = async (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    if (!['.mp3', '.flac', '.wav', '.m4a', '.ogg', '.aac'].includes(ext)) return;

    try {
      const newHash = await sha256FileStream(filePath);
      const stats = fs.statSync(filePath);
      const metadata = await mm.parseFile(filePath);

      const resolved = resolveScanTrackMeta(filePath, watchPath, metadata);
      const title = resolved.title;
      const duration = resolved.duration;
      const year = resolved.year;
      const genre = resolved.genre;
      const albumName = resolved.albumName;
      const trackNo = resolved.trackNo;
      const discNo = resolved.discNo;

      const trackArtistNames = resolved.trackArtistNames;
      const albumArtistTagNames = resolved.albumArtistTagNames;
      const albumNamesForAlbum = resolved.albumNamesForAlbum;

      const maskByName = new Map();
      const addRoleBits = (name, bits) => {
        const k = name.trim();
        if (!k) return;
        maskByName.set(k, (maskByName.get(k) ?? 0) | bits);
      };
      const composerNames = splitArtistNames(metadata.common.composer);
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
        // 태그에 앨범명이 없으면 'Unknown Album' 하나로 모은다.
        // (예전엔 `Unknown Album (${title})`로 트랙마다 따로 만들어 누락 시 폭발했음)
        const safeAlbumName = (albumName && String(albumName).trim()) || 'Unknown Album';
        
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
            db.prepare(`
              INSERT INTO track_filedata (id, path, size, duration, bitrate, format, source)
              VALUES (?, ?, ?, ?, ?, ?, 'scan')
            `).run(newHash, filePath, stats.size, duration, Math.round(metadata.format.bitrate / 1000), metadata.format.container);

            db.prepare('UPDATE track_metadata SET file_id = ?, title = ?, year = ?, genre = ? WHERE id = ?').run(newHash, title, year, genre, currentTrackId);
            // ⚠️ FK ON DELETE CASCADE 안전성: track_metadata file_id 교체 후 이전 filedata 삭제
            db.prepare('DELETE FROM track_filedata WHERE id = ?').run(existingByPath.hash);
            db.prepare('DELETE FROM track_artists WHERE track_id = ?').run(currentTrackId);
          } else {
            // filedata(path)는 있는데 metadata 연결이 끊긴 고아 상태 복구
            db.prepare('DELETE FROM track_filedata WHERE id = ?').run(existingByPath.hash);
            currentTrackId = ulid();
            db.prepare(`
              INSERT INTO track_filedata (id, path, size, duration, bitrate, format, source)
              VALUES (?, ?, ?, ?, ?, ?, 'scan')
            `).run(newHash, filePath, stats.size, duration, Math.round(metadata.format.bitrate / 1000), metadata.format.container);
            db.prepare('INSERT INTO track_metadata (id, file_id, title, year, genre) VALUES (?, ?, ?, ?, ?)').run(currentTrackId, newHash, title, year, genre);
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

      bumpLibraryRevision();

    } catch (err) {
      if (err.code !== 'EBUSY' && err.code !== 'ENOENT') {
        console.error(`❌ 스캔 오류 (${filePath}):`, err.message);
      }
      throw err;
    }
  };

  // 이벤트 폭주(add/change 연속) 시 DB/파싱 경쟁을 피하려고 파일 단위 디바운스 + 전역 직렬 처리
  let queue = Promise.resolve();
  const scheduled = new Map();
  const debounceMs = 350;

  const processWithRetry = async (filePath, retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        await handleFile(filePath);
        return;
      } catch (err) {
        const retryable = err?.code === 'EBUSY' || err?.code === 'ENOENT';
        if (!retryable || i === retries - 1) {
          if (!retryable) {
            console.error(`❌ 스캔 실패 (재시도 불가) ${filePath}:`, err.message);
          } else {
            console.error(`❌ 스캔 실패 (재시도 소진) ${filePath}:`, err.message);
          }
          return;
        }
        await new Promise((r) => setTimeout(r, 250 * (i + 1)));
      }
    }
  };

  const enqueueFile = (filePath) => {
    const prev = scheduled.get(filePath);
    if (prev) clearTimeout(prev);
    const timer = setTimeout(() => {
      scheduled.delete(filePath);
      queue = queue
        .then(() => processWithRetry(filePath))
        .catch((e) => {
          console.error('❌ 스캔 큐 처리 중 오류:', e?.message || e);
        });
    }, debounceMs);
    scheduled.set(filePath, timer);
  };

  const handleUnlink = (filePath) => {
    if (isExcludedScanPath(filePath)) return;
    queue = queue.then(() => {
      const row = db.prepare('SELECT id FROM track_filedata WHERE path = ?').get(filePath);
      if (!row) return;
      // track_filedata 삭제는 FK CASCADE로 track_metadata / album_tracks / track_artists / play_history 까지 비운다.
      db.prepare('DELETE FROM track_filedata WHERE id = ?').run(row.id);
      // 트랙이 빠진 뒤에 남는 빈 앨범과 고아 아티스트를 함께 정리.
      try {
        const { albumsRemoved, artistsRemoved } = cleanupOrphans();
        if (albumsRemoved || artistsRemoved) {
          console.log(
            `🧹 [Scanner] orphan 정리: 앨범 ${albumsRemoved}개 · 아티스트 ${artistsRemoved}개 제거`,
          );
        }
      } catch (cleanupErr) {
        console.error('❌ orphan 정리 중 오류:', cleanupErr?.message || cleanupErr);
      }
      bumpLibraryRevision();
    }).catch((e) => {
      console.error(`❌ 삭제 동기화 오류 (${filePath}):`, e?.message || e);
    });
  };

  watcher.on('add', enqueueFile);
  watcher.on('change', enqueueFile);
  watcher.on('unlink', handleUnlink);
}