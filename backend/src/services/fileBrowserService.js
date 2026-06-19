import fs from 'node:fs';
import path from 'node:path';
import { getDB } from '../db.js';
import { assertInsideTracksRoot } from '../lib/pathSanitize.js';
import { isExcludedScanPath, SCAN_EXCLUDED_DIR } from './scanner.js';

const AUDIO_EXT = new Set(['.mp3', '.flac', '.wav', '.m4a', '.ogg', '.aac']);

/**
 * API·UI용 상대 경로 정규화 (posix, `..` 거부).
 * @param {string} input
 */
export function normalizeRelativePath(input) {
  if (!input || typeof input !== 'string') return '';
  if (input.includes('\0')) {
    const err = new Error('Invalid path');
    err.statusCode = 400;
    throw err;
  }
  const parts = input.replace(/\\/g, '/').split('/').filter((p) => p && p !== '.');
  for (const p of parts) {
    if (p === '..') {
      const err = new Error('Invalid path');
      err.statusCode = 400;
      throw err;
    }
  }
  return parts.join('/');
}

/**
 * @param {string} tracksRoot
 * @param {string} [relativePath='']
 */
export function listFilesDirectory(tracksRoot, relativePath = '') {
  const root = path.resolve(tracksRoot);
  const rel = normalizeRelativePath(relativePath);
  const dirAbs = rel ? path.join(root, ...rel.split('/')) : root;

  let safeDir;
  try {
    safeDir = assertInsideTracksRoot(root, dirAbs);
  } catch {
    const err = new Error('Invalid path');
    err.statusCode = 400;
    throw err;
  }

  if (!fs.existsSync(safeDir)) {
    if (!rel) {
      return { path: '', parent: null, entries: [] };
    }
    const err = new Error('Directory not found');
    err.statusCode = 404;
    throw err;
  }

  const dirStat = fs.statSync(safeDir);
  if (!dirStat.isDirectory()) {
    const err = new Error('Not a directory');
    err.statusCode = 400;
    throw err;
  }

  const dirents = fs.readdirSync(safeDir, { withFileTypes: true });
  const dirEntries = [];
  const fileCandidates = [];

  for (const d of dirents) {
    const name = d.name;
    if (name.startsWith('.')) continue;

    const abs = path.join(safeDir, name);

    if (d.isDirectory()) {
      let mtime = null;
      try {
        mtime = fs.statSync(abs).mtime.toISOString();
      } catch {
        /* ignore */
      }
      dirEntries.push({
        name,
        kind: 'directory',
        excluded: name === SCAN_EXCLUDED_DIR || isExcludedScanPath(abs),
        size: null,
        mtime,
        isAudio: false,
        inLibrary: false,
        trackId: null,
        trackTitle: null,
      });
    } else if (d.isFile()) {
      fileCandidates.push({ name, abs });
    }
  }

  const trackByPath = new Map();
  if (fileCandidates.length) {
    const absPaths = fileCandidates.map((f) => f.abs);
    const placeholders = absPaths.map(() => '?').join(',');
    const rows = getDB()
      .prepare(
        `SELECT f.path, t.id AS trackId, t.title AS trackTitle
         FROM track_filedata f
         LEFT JOIN track_metadata t ON t.file_id = f.id
         WHERE f.path IN (${placeholders})`,
      )
      .all(...absPaths);
    for (const row of rows) {
      trackByPath.set(row.path, row);
    }
  }

  const fileEntries = fileCandidates.map(({ name, abs }) => {
    let size = null;
    let mtime = null;
    try {
      const s = fs.statSync(abs);
      size = s.size;
      mtime = s.mtime.toISOString();
    } catch {
      /* ignore */
    }

    const ext = path.extname(name).toLowerCase();
    const isAudio = AUDIO_EXT.has(ext);
    const track = trackByPath.get(abs);

    return {
      name,
      kind: 'file',
      excluded: isExcludedScanPath(abs),
      size,
      mtime,
      isAudio,
      inLibrary: Boolean(track?.trackId),
      trackId: track?.trackId ?? null,
      trackTitle: track?.trackTitle ?? null,
    };
  });

  const entries = [...dirEntries, ...fileEntries];
  entries.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  const parent = rel ? rel.split('/').slice(0, -1).join('/') : null;

  return { path: rel, parent, entries };
}

/**
 * @param {string} tracksRoot
 * @param {string} relativePath
 */
export function resolveSafeAbsolutePath(tracksRoot, relativePath) {
  const root = path.resolve(tracksRoot);
  const rel = normalizeRelativePath(relativePath);
  if (!rel) {
    const err = new Error('Cannot delete library root');
    err.statusCode = 400;
    throw err;
  }
  const abs = path.join(root, ...rel.split('/'));
  try {
    return { rel, abs: assertInsideTracksRoot(root, abs) };
  } catch {
    const err = new Error('Invalid path');
    err.statusCode = 400;
    throw err;
  }
}

/**
 * 파일 또는 폴더(재귀) 영구 삭제. 스캐너 unlink가 DB를 정리한다.
 * @param {string} tracksRoot
 * @param {string} relativePath
 */
export function deleteFileOrDirectory(tracksRoot, relativePath) {
  const { rel, abs } = resolveSafeAbsolutePath(tracksRoot, relativePath);

  if (!fs.existsSync(abs)) {
    const err = new Error('Path not found');
    err.statusCode = 404;
    throw err;
  }

  const stat = fs.statSync(abs);
  if (stat.isDirectory()) {
    fs.rmSync(abs, { recursive: true, force: true });
  } else if (stat.isFile()) {
    fs.unlinkSync(abs);
  } else {
    const err = new Error('Unsupported entry type');
    err.statusCode = 400;
    throw err;
  }

  return { path: rel, kind: stat.isDirectory() ? 'directory' : 'file' };
}
