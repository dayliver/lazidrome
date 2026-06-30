import fs from 'node:fs';
import path from 'node:path';
import * as mm from 'music-metadata';
import { ulid } from 'ulid';
import { sha256FileStream } from '../lib/fileHash.js';
import { assertInsideTracksRoot } from '../lib/pathSanitize.js';
import { resolveTrackFilePath } from '../lib/trackPath.js';
import { bumpLibraryRevisionNow } from '../lib/libraryRevision.js';
import { TRACKS_PATH, ensureImportTempDir } from '../lib/importEnv.js';
import {
  findTrackFileForReplace,
  findTrackEmbedTags,
  findOtherTrackByFileId,
  swapTrackFileRecord,
  findTrackDetailById,
} from '../repositories/trackRepository.js';
import { formatTrackDetail } from './trackService.js';
import { resolveStagedSource, cancelStagedUpload } from './uploadStagingService.js';
import { downloadOne } from './youtubeImportService.js';

function httpError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function parseAudioFileStats(filePath) {
  const stats = fs.statSync(filePath);
  const metadata = await mm.parseFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const duration = metadata.format.duration || 0;
  const bitrate = metadata.format.bitrate
    ? Math.round(metadata.format.bitrate / 1000)
    : null;
  const format = ext.replace('.', '') || metadata.format.container || null;
  return { stats, duration, bitrate, format, ext };
}

function resolveDestPath(currentResolvedPath, newExt) {
  const oldExt = path.extname(currentResolvedPath).toLowerCase();
  let destPath = currentResolvedPath;
  if (newExt && newExt !== oldExt) {
    destPath = path.join(path.dirname(currentResolvedPath), path.basename(currentResolvedPath, oldExt) + newExt);
  }
  return assertInsideTracksRoot(TRACKS_PATH, path.resolve(destPath));
}

async function installAudioAtPath(sourcePath, destPath) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const tmp = `${destPath}.${ulid()}.tmp`;
  await fs.promises.copyFile(sourcePath, tmp);
  await fs.promises.rename(tmp, destPath);
}

function safeUnlink(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    /* ignore */
  }
}

async function acquireSourcePath(trackId, opts) {
  if (opts.source === 'staging') {
    const stagingId = String(opts.stagingId ?? '').trim();
    if (!stagingId) throw httpError('stagingId가 필요합니다.');
    const { sourcePath } = resolveStagedSource(stagingId);
    return { sourcePath, cleanup: () => cancelStagedUpload(stagingId) };
  }

  if (opts.source === 'youtube') {
    const url = String(opts.url ?? '').trim();
    const videoId = String(opts.videoId ?? '').trim();
    if (!url && !videoId) throw httpError('YouTube URL 또는 videoId가 필요합니다.');

    const tagsRow = findTrackEmbedTags(trackId);
    const tags = {
      title: tagsRow?.title || 'track',
      artist: tagsRow?.artist || 'Unknown Artist',
      album: tagsRow?.album || 'Unknown Album',
    };

    const tempDest = path.join(ensureImportTempDir(), `replace-${ulid()}.mp3`);
    await downloadOne({
      videoId,
      webpageUrl: opts.webpageUrl,
      sourceUrl: url,
      tags,
      destPath: tempDest,
    });

    return {
      sourcePath: tempDest,
      cleanup: () => safeUnlink(tempDest),
    };
  }

  throw httpError('source는 staging 또는 youtube여야 합니다.');
}

/**
 * @param {string} trackId
 * @param {{ source: 'staging' | 'youtube', stagingId?: string, url?: string, videoId?: string, webpageUrl?: string }} opts
 */
export async function replaceTrackAudio(trackId, opts) {
  const row = findTrackFileForReplace(trackId);
  if (!row) throw httpError('트랙을 찾을 수 없습니다.', 404);

  const oldFileId = row.fileId;
  const storedPath = row.path;
  const resolvedPath = resolveTrackFilePath(storedPath, TRACKS_PATH);
  if (!resolvedPath) throw httpError('트랙 파일 경로를 확인할 수 없습니다.', 422);

  const { sourcePath, cleanup } = await acquireSourcePath(trackId, opts);

  try {
    const newHash = await sha256FileStream(sourcePath);
    const { stats, duration, bitrate, format, ext } = await parseAudioFileStats(sourcePath);
    const finalPath = resolveDestPath(resolvedPath, ext);

    const other = findOtherTrackByFileId(newHash, trackId);
    if (other) {
      throw httpError('이 오디오 파일은 다른 곡에 이미 등록되어 있습니다.', 409);
    }

    const previousPath = resolvedPath;
    const oldFileSnapshot = {
      id: row.fileId,
      path: row.path,
      size: row.size,
      duration: row.duration,
      bitrate: row.bitrate,
      format: row.format,
    };

    swapTrackFileRecord(trackId, oldFileId, {
      id: newHash,
      path: finalPath,
      size: stats.size,
      duration,
      bitrate,
      format,
    });

    try {
      await installAudioAtPath(sourcePath, finalPath);
    } catch (installErr) {
      swapTrackFileRecord(trackId, newHash, oldFileSnapshot);
      throw installErr;
    }

    if (finalPath !== previousPath) {
      safeUnlink(previousPath);
    }

    bumpLibraryRevisionNow();

    const detail = findTrackDetailById(trackId);
    return formatTrackDetail(detail);
  } finally {
    cleanup?.();
  }
}
