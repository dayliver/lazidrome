import fs from 'node:fs';
import path from 'node:path';
import { getDB } from '../db.js';

/**
 * DB에 예전 절대경로(폴더 이동·대소문자 차이)가 남아 있을 때 storage/tracks 기준으로 다시 찾습니다.
 */
export function resolveTrackFilePath(storedPath, tracksRoot) {
  if (!storedPath) return null;
  if (fs.existsSync(storedPath)) return storedPath;

  const root = path.resolve(tracksRoot || process.env.TRACKS_PATH || './storage/tracks');
  const base = path.basename(storedPath);
  if (!base) return storedPath;

  const candidate = path.join(root, base);
  if (fs.existsSync(candidate)) return candidate;

  return storedPath;
}

/** 기동 시 한 번: basename이 일치하는 실제 파일로 path 갱신 */
export function rebindTrackFilePaths(tracksRoot) {
  const db = getDB();
  const root = path.resolve(tracksRoot);
  if (!fs.existsSync(root)) return { updated: 0, missing: 0 };

  const rows = db.prepare('SELECT id, path FROM track_filedata').all();
  let updated = 0;
  let missing = 0;
  const update = db.prepare('UPDATE track_filedata SET path = ? WHERE id = ?');

  for (const row of rows) {
    if (!row.path) {
      missing += 1;
      continue;
    }
    if (fs.existsSync(row.path)) continue;

    const base = path.basename(row.path);
    const candidate = path.join(root, base);
    if (fs.existsSync(candidate)) {
      update.run(candidate, row.id);
      updated += 1;
    } else {
      missing += 1;
    }
  }

  if (updated > 0) {
    console.log(`🔧 track_filedata 경로 ${updated}건을 ${root} 기준으로 갱신했습니다.`);
  }
  if (missing > 0) {
    console.warn(`⚠️  물리 파일을 찾지 못한 트랙 ${missing}건 (DB에는 있음)`);
  }
}
