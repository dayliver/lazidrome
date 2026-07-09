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
import {
  isAudioFilePath,
  MIN_AUDIO_BYTES,
} from '../lib/audioExtensions.js';

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

function isIgnoredWatchPath(filePath) {
  if (isExcludedScanPath(filePath)) return true;
  if (/(^|[/\\])\../.test(filePath)) return true;
  if (/\.tagging\./i.test(path.basename(filePath))) return true;
  return false;
}

function formatBitrateKbps(format) {
  const raw = format?.bitrate;
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw / 1000) : null;
}

function resolveDurationSec(resolvedDuration, format) {
  if (Number.isFinite(resolvedDuration) && resolvedDuration > 0) {
    return resolvedDuration;
  }
  const fromFormat = format?.duration;
  return Number.isFinite(fromFormat) && fromFormat > 0 ? fromFormat : 0;
}

export function startScanner(watchPath) {
  const resolvedWatchPath = path.resolve(watchPath);
  const IMAGES_PATH = process.env.IMAGES_PATH || './storage/images';

  console.log(`🔍 스캐너 가동: ${resolvedWatchPath} 감시 중...`);

  const handleFile = async (filePath) => {
    if (!isAudioFilePath(filePath)) return;

    try {
      const stats = fs.statSync(filePath);
      if (stats.size < MIN_AUDIO_BYTES) {
        console.warn(`⚠️ 스캔 스킵 (파일 너무 작음): ${filePath}`);
        return;
      }

      const newHash = await sha256FileStream(filePath);
      const metadata = await mm.parseFile(filePath);

      const resolved = resolveScanTrackMeta(filePath, resolvedWatchPath, metadata);
      const title = resolved.title;
      const year = resolved.year;
      const genre = resolved.genre;
      const albumName = resolved.albumName;
      const trackNo = resolved.trackNo;
      const discNo = resolved.discNo;

      const trackArtistNames = resolved.trackArtistNames;
      const albumArtistTagNames = resolved.albumArtistTagNames;
      const albumNamesForAlbum = resolved.albumNamesForAlbum;

      const durationSec = resolveDurationSec(resolved.duration, metadata.format);
      const bitrateKbps = formatBitrateKbps(metadata.format);
      const format = metadata.format?.container || null;

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
          i === 0 ? ROLES.PERFORMER : ROLES.FEATURING,
        );
      }
      for (const n of albumArtistTagNames) addRoleBits(n, ROLES.PERFORMER);
      for (const n of composerNames) addRoleBits(n, ROLES.COMPOSER);

      let albumId = null;

      const transaction = db.transaction(() => {
        const existingByHash = db.prepare('SELECT id, path FROM track_filedata WHERE id = ?').get(newHash);
        const existingByPath = db.prepare('SELECT id as hash FROM track_filedata WHERE path = ?').get(filePath);

        if (existingByHash) {
          db.prepare(`
            UPDATE track_filedata
            SET path = ?, size = ?, duration = ?, bitrate = ?, format = ?
            WHERE id = ?
          `).run(filePath, stats.size, durationSec, bitrateKbps, format, newHash);

          const metaRecord = db.prepare('SELECT id FROM track_metadata WHERE file_id = ?').get(newHash);
          if (metaRecord) {
            db.prepare('UPDATE track_metadata SET title = ?, year = ?, genre = ? WHERE id = ?').run(
              title,
              year,
              genre,
              metaRecord.id,
            );
            return;
          }
        }

        const getOrCreateArtistIds = (names) => {
          return names.map((name) => {
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

        const safeAlbumName = (albumName && String(albumName).trim()) || 'Unknown Album';

        const candidateAlbums = db.prepare('SELECT id FROM albums WHERE name = ?').all(safeAlbumName);

        for (const row of candidateAlbums) {
          const existingArtists = db
            .prepare('SELECT artist_id FROM album_artists WHERE album_id = ?')
            .all(row.id)
            .map((a) => a.artist_id);

          const sortedA = [...albumArtistIds].sort().join(',');
          const sortedB = [...existingArtists].sort().join(',');

          if (sortedA === sortedB) {
            albumId = row.id;
            break;
          }
        }

        if (!albumId) {
          albumId = ulid();
          db.prepare('INSERT INTO albums (id, name, year) VALUES (?, ?, ?)').run(albumId, safeAlbumName, year);

          const insertAlbumArtist = db.prepare('INSERT INTO album_artists (album_id, artist_id) VALUES (?, ?)');
          for (const aId of albumArtistIds) {
            insertAlbumArtist.run(albumId, aId);
          }
        }

        let currentTrackId = null;

        if (existingByHash) {
          currentTrackId = ulid();
          db.prepare('INSERT INTO track_metadata (id, file_id, title, year, genre) VALUES (?, ?, ?, ?, ?)').run(
            currentTrackId,
            newHash,
            title,
            year,
            genre,
          );
        } else if (existingByPath) {
          const metaRecord = db.prepare('SELECT id FROM track_metadata WHERE file_id = ?').get(existingByPath.hash);
          currentTrackId = metaRecord?.id;

          if (currentTrackId) {
            db.prepare(`
              INSERT INTO track_filedata (id, path, size, duration, bitrate, format, source)
              VALUES (?, ?, ?, ?, ?, ?, 'scan')
            `).run(newHash, filePath, stats.size, durationSec, bitrateKbps, format);

            db.prepare('UPDATE track_metadata SET file_id = ?, title = ?, year = ?, genre = ? WHERE id = ?').run(
              newHash,
              title,
              year,
              genre,
              currentTrackId,
            );
            db.prepare('DELETE FROM track_filedata WHERE id = ?').run(existingByPath.hash);
            db.prepare('DELETE FROM track_artists WHERE track_id = ?').run(currentTrackId);
          } else {
            db.prepare('DELETE FROM track_filedata WHERE id = ?').run(existingByPath.hash);
            currentTrackId = ulid();
            db.prepare(`
              INSERT INTO track_filedata (id, path, size, duration, bitrate, format, source)
              VALUES (?, ?, ?, ?, ?, ?, 'scan')
            `).run(newHash, filePath, stats.size, durationSec, bitrateKbps, format);
            db.prepare('INSERT INTO track_metadata (id, file_id, title, year, genre) VALUES (?, ?, ?, ?, ?)').run(
              currentTrackId,
              newHash,
              title,
              year,
              genre,
            );
          }
        } else {
          currentTrackId = ulid();
          db.prepare(`
            INSERT INTO track_filedata (id, path, size, duration, bitrate, format, source)
            VALUES (?, ?, ?, ?, ?, ?, 'scan')
          `).run(newHash, filePath, stats.size, durationSec, bitrateKbps, format);

          db.prepare('INSERT INTO track_metadata (id, file_id, title, year, genre) VALUES (?, ?, ?, ?, ?)').run(
            currentTrackId,
            newHash,
            title,
            year,
            genre,
          );
        }

        if (currentTrackId) {
          const insertTrackArtist = db.prepare(
            'INSERT INTO track_artists (track_id, artist_id, role_mask) VALUES (?, ?, ?)',
          );
          for (const [name, mask] of maskByName) {
            if (!mask) continue;
            const artistId = getOrCreateArtistIds([name])[0];
            insertTrackArtist.run(currentTrackId, artistId, mask);
          }

          const existingLink = db
            .prepare('SELECT id FROM album_tracks WHERE album_id = ? AND track_id = ?')
            .get(albumId, currentTrackId);
          if (!existingLink) {
            const primaryCheck = db
              .prepare('SELECT count(*) as cnt FROM album_tracks WHERE track_id = ? AND is_primary = 1')
              .get(currentTrackId);
            const isPrimary = primaryCheck.cnt === 0 ? 1 : 0;
            db.prepare(
              'INSERT INTO album_tracks (id, album_id, track_id, is_primary, track_number, disc_number) VALUES (?, ?, ?, ?, ?, ?)',
            ).run(ulid(), albumId, currentTrackId, isPrimary, trackNo, discNo);
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
            console.error('❌ [Scanner] 커버 처리 중 오류:', sharpErr.message);
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

  const watcher = chokidar.watch(resolvedWatchPath, {
    ignored: (p) => isIgnoredWatchPath(p),
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100,
    },
  });

  let queue = Promise.resolve();
  const scheduled = new Map();
  const debounceMs = 350;

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
    queue = queue
      .then(() => {
        const row = db.prepare('SELECT id FROM track_filedata WHERE path = ?').get(filePath);
        if (!row) return;
        db.prepare('DELETE FROM track_filedata WHERE id = ?').run(row.id);
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
      })
      .catch((e) => {
        console.error(`❌ 삭제 동기화 오류 (${filePath}):`, e?.message || e);
      });
  };

  watcher.on('add', enqueueFile);
  watcher.on('change', enqueueFile);
  watcher.on('unlink', handleUnlink);
}
