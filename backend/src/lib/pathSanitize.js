import fs from 'node:fs';
import path from 'node:path';

/** 경로 세그먼트(아티스트·앨범·파일명)에 쓸 수 없는 문자 제거 */
export function sanitizePathSegment(raw, fallback = 'Unknown') {
  let s = String(raw ?? '').trim();
  if (!s) return fallback;
  // 제어문자·경로 구분자·Windows 금지 문자
  s = s.replace(/[\x00-\x1f<>:"/\\|?*]/g, '').replace(/\.\./g, '');
  s = s.replace(/[. ]+$/g, ''); // trailing dots/spaces (Windows)
  s = s.slice(0, 200);
  return s || fallback;
}

/**
 * TRACKS_PATH 기준 최종 저장 디렉터리.
 * - artist+album → root/artist/album
 * - artist only → root/artist
 * - neither → root (flat)
 */
export function buildDestDir(tracksRoot, { artist, album } = {}) {
  const root = path.resolve(tracksRoot);
  const a = String(artist ?? '').trim();
  const alb = String(album ?? '').trim();

  if (a && alb) {
    return path.join(root, sanitizePathSegment(a), sanitizePathSegment(alb, 'Unknown Album'));
  }
  if (a) {
    return path.join(root, sanitizePathSegment(a));
  }
  return root;
}

/**
 * @param {string} destDir
 * @param {string} title
 * @returns {string} absolute path for .mp3
 */
export function buildDestFilePath(destDir, title) {
  const base = sanitizePathSegment(title, 'track');
  return path.join(destDir, `${base}.mp3`);
}

/**
 * `{artist} - {album} - {title}{ext}` 파일명 (폴더는 buildDestDir 사용).
 */
export function buildTrackFileName({ artist, album, title, ext = '.mp3' } = {}) {
  const parts = [
    sanitizePathSegment(artist, 'Unknown Artist'),
    sanitizePathSegment(album, 'Unknown Album'),
    sanitizePathSegment(title, 'track'),
  ];
  const base = parts.join(' - ');
  const e = String(ext).toLowerCase().startsWith('.') ? String(ext).toLowerCase() : `.${String(ext).toLowerCase()}`;
  const maxBase = Math.max(1, 200 - e.length);
  const trimmed = base.length > maxBase ? base.slice(0, maxBase).replace(/[. ]+$/g, '') : base;
  return `${trimmed || 'track'}${e}`;
}

/** 동일 경로가 있으면 ` (2)` suffix */
export function uniqueDestPath(destPath) {
  if (!fs.existsSync(destPath)) return destPath;
  const dir = path.dirname(destPath);
  const ext = path.extname(destPath);
  const base = path.basename(destPath, ext);
  let n = 2;
  while (fs.existsSync(path.join(dir, `${base} (${n})${ext}`))) n += 1;
  return path.join(dir, `${base} (${n})${ext}`);
}

/** dest가 tracksRoot 밖으로 나가지 않는지 확인 */
export function assertInsideTracksRoot(tracksRoot, destPath) {
  const root = path.resolve(tracksRoot);
  const resolved = path.resolve(destPath);
  const rel = path.relative(root, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error('Destination path escapes tracks root');
  }
  return resolved;
}
