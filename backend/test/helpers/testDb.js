import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ulid } from 'ulid';

/**
 * 임시 DB를 만들고 `LAZI_DB_PATH`를 걸어둔다.
 * `src/db.js`는 import 시점에 연결을 열므로 **어떤 src 모듈보다 먼저** 호출해야 한다.
 * @returns {{ dir: string, dbPath: string, cleanup: () => void }}
 */
export function useTempDatabase() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lazidrome-test-'));
  const dbPath = path.join(dir, 'test.db');
  process.env.LAZI_DB_PATH = dbPath;
  return {
    dir,
    dbPath,
    cleanup() {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
      delete process.env.LAZI_DB_PATH;
    },
  };
}

/**
 * 재생 기록 테스트에 필요한 최소 트랙 한 곡.
 * @param {import('better-sqlite3').Database} db
 * @param {{ title?: string, durationSec?: number, artistName?: string, albumName?: string }} opts
 * @returns {{ trackId: string, fileId: string, artistId: string|null, albumId: string|null }}
 */
export function seedTrack(db, { title = 'Test Track', durationSec = 200, artistName = null, albumName = null } = {}) {
  const fileId = ulid();
  const trackId = ulid();

  db.prepare(
    `INSERT INTO track_filedata (id, path, format, size, duration, bitrate)
     VALUES (?, ?, 'MPEG', 1000, ?, 320)`
  ).run(fileId, `/tmp/${fileId}.mp3`, durationSec);

  db.prepare('INSERT INTO track_metadata (id, file_id, title) VALUES (?, ?, ?)').run(
    trackId,
    fileId,
    title
  );

  let artistId = null;
  if (artistName) {
    artistId = ulid();
    db.prepare('INSERT INTO artists (id, name) VALUES (?, ?)').run(artistId, artistName);
    db.prepare(
      'INSERT INTO track_artists (track_id, artist_id, role_mask) VALUES (?, ?, 1)'
    ).run(trackId, artistId);
  }

  let albumId = null;
  if (albumName) {
    albumId = ulid();
    db.prepare('INSERT INTO albums (id, name) VALUES (?, ?)').run(albumId, albumName);
    db.prepare(
      'INSERT INTO album_tracks (id, album_id, track_id, is_primary) VALUES (?, ?, ?, 1)'
    ).run(ulid(), albumId, trackId);
  }

  return { trackId, fileId, artistId, albumId };
}

/** 지정한 시각으로 재생 기록을 직접 넣는다 (기간 필터 테스트용) */
export function insertPlay(db, { trackId, playedAt, listenedSec = 100, deviceId = null }) {
  return db
    .prepare(
      'INSERT INTO play_history (track_id, played_at, listened_sec, device_id) VALUES (?, ?, ?, ?)'
    )
    .run(trackId, playedAt, listenedSec, deviceId).lastInsertRowid;
}

/** initDB()의 콘솔 로그로 테스트 출력이 묻히지 않게 한다 */
export function silenceConsole() {
  const original = { log: console.log, error: console.error };
  console.log = () => {};
  console.error = () => {};
  return () => {
    console.log = original.log;
    console.error = original.error;
  };
}
