import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import * as mm from 'music-metadata';
import { ulid } from 'ulid';
import {
  buildDestDir,
  buildTrackFileName,
  uniqueDestPath,
  assertInsideTracksRoot,
} from '../lib/pathSanitize.js';
import { writeAudioFileWithTags } from '../lib/writeAudioTags.js';
import {
  ensureImportTempDir,
  TRACKS_PATH,
} from '../lib/importEnv.js';

const STAGING_SUBDIR = 'staging';
const STAGING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const ALLOWED_EXT = new Set([
  '.mp3', '.flac', '.m4a', '.aac', '.ogg', '.opus', '.wav', '.wma', '.ape', '.alac',
]);

function stagingRoot() {
  return path.join(ensureImportTempDir(), STAGING_SUBDIR);
}

function workDirFor(stagingId) {
  return path.join(stagingRoot(), stagingId);
}

function stagedSourcePath(workDir, ext) {
  return path.join(workDir, `source${ext}`);
}

function readManifest(workDir) {
  const manifestPath = path.join(workDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    const err = new Error('Staging session not found');
    err.statusCode = 404;
    throw err;
  }
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

export function cleanupOldStaging(maxAgeMs = STAGING_MAX_AGE_MS) {
  const root = stagingRoot();
  if (!fs.existsSync(root)) return 0;
  const cutoff = Date.now() - maxAgeMs;
  let removed = 0;
  for (const name of fs.readdirSync(root)) {
    const dir = path.join(root, name);
    try {
      const stat = fs.statSync(dir);
      if (!stat.isDirectory()) continue;
      let createdAt = stat.mtimeMs;
      const manifestPath = path.join(dir, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        try {
          createdAt = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).createdAt ?? createdAt;
        } catch {
          /* ignore */
        }
      }
      if (createdAt < cutoff) {
        fs.rmSync(dir, { recursive: true, force: true });
        removed += 1;
      }
    } catch {
      /* ignore */
    }
  }
  return removed;
}

/**
 * @param {import('@fastify/multipart').MultipartFile} fileData
 */
export async function stageUploadedFile(fileData) {
  cleanupOldStaging();

  const ext = path.extname(fileData.filename || '').toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    const err = new Error(`허용되지 않는 확장자입니다: ${ext || '(없음)'}`);
    err.statusCode = 400;
    throw err;
  }

  const stagingId = ulid();
  const workDir = workDirFor(stagingId);
  fs.mkdirSync(workDir, { recursive: true });
  const sourcePath = stagedSourcePath(workDir, ext);

  try {
    await pipeline(fileData.file, fs.createWriteStream(sourcePath));

    let title = path.basename(fileData.filename || 'track', ext);
    let artist = '';
    let album = '';
    try {
      const metadata = await mm.parseFile(sourcePath);
      title = metadata.common.title || title;
      artist = metadata.common.artist || metadata.common.albumartist || '';
      album = metadata.common.album || '';
    } catch {
      /* 태그 없음 */
    }

    const manifest = {
      stagingId,
      originalName: fileData.filename || `upload${ext}`,
      ext,
      createdAt: Date.now(),
      hints: { title, artist, album },
    };
    fs.writeFileSync(path.join(workDir, 'manifest.json'), JSON.stringify(manifest));

    return {
      stagingId,
      originalName: manifest.originalName,
      ext,
      title,
      artist,
      album,
    };
  } catch (err) {
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    throw err;
  }
}

async function writeFileWithMetadata(sourcePath, destPath, tags) {
  const ok = await writeAudioFileWithTags(sourcePath, destPath, tags);
  if (ok) return;

  const err = new Error(
    '오디오 파일에 메타데이터를 기록하지 못했습니다. ffmpeg 설치 및 PATH 설정을 확인하세요.',
  );
  err.statusCode = 422;
  err.code = 'TAG_EMBED_FAILED';
  throw err;
}

/**
 * @param {{ stagingId: string, title: string, artist: string, album: string }} item
 */
export async function commitStagedUpload(item) {
  const { stagingId } = item;
  const title = String(item.title ?? '').trim();
  const artist = String(item.artist ?? '').trim();
  const album = String(item.album ?? '').trim();

  if (!stagingId || !title || !artist || !album) {
    const err = new Error('stagingId, title, artist, album are required');
    err.statusCode = 400;
    throw err;
  }

  const workDir = workDirFor(stagingId);
  const manifest = readManifest(workDir);
  const sourcePath = stagedSourcePath(workDir, manifest.ext);
  if (!fs.existsSync(sourcePath)) {
    const err = new Error('Staged file missing');
    err.statusCode = 404;
    throw err;
  }

  const destDir = buildDestDir(TRACKS_PATH, { artist, album });
  fs.mkdirSync(destDir, { recursive: true });

  const fileName = buildTrackFileName({ artist, album, title, ext: manifest.ext });
  let destPath = path.join(destDir, fileName);
  destPath = assertInsideTracksRoot(TRACKS_PATH, destPath);
  destPath = uniqueDestPath(destPath);

  await writeFileWithMetadata(sourcePath, destPath, { title, artist, album });

  try {
    fs.rmSync(workDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }

  const relativePath = path.relative(path.resolve(TRACKS_PATH), destPath).replace(/\\/g, '/');
  return { stagingId, relativePath, fileName: path.basename(destPath) };
}

/** @returns {{ sourcePath: string, manifest: object, workDir: string }} */
export function resolveStagedSource(stagingId) {
  if (!stagingId) {
    const err = new Error('stagingId required');
    err.statusCode = 400;
    throw err;
  }
  const workDir = workDirFor(stagingId);
  const manifest = readManifest(workDir);
  const sourcePath = stagedSourcePath(workDir, manifest.ext);
  if (!fs.existsSync(sourcePath)) {
    const err = new Error('Staged file missing');
    err.statusCode = 404;
    throw err;
  }
  return { sourcePath, manifest, workDir };
}

export function cancelStagedUpload(stagingId) {
  if (!stagingId) {
    const err = new Error('stagingId required');
    err.statusCode = 400;
    throw err;
  }
  const workDir = workDirFor(stagingId);
  if (!fs.existsSync(workDir)) {
    const err = new Error('Staging session not found');
    err.statusCode = 404;
    throw err;
  }
  fs.rmSync(workDir, { recursive: true, force: true });
  return { stagingId, cancelled: true };
}
