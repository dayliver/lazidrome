import fs from 'node:fs';
import path from 'node:path';

export function resolveYtDlpBin() {
  return process.env.YT_DLP_BIN?.trim() || 'yt-dlp';
}

export function resolveFfmpegBin() {
  return process.env.FFMPEG_BIN?.trim() || 'ffmpeg';
}

export function resolveImportTempDir() {
  const raw = process.env.IMPORT_TEMP_DIR?.trim();
  if (raw) return path.resolve(raw);
  return path.resolve('/dev/shm/lazidrome-import');
}

export function ensureImportTempDir() {
  const dir = resolveImportTempDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export const TRACKS_PATH = process.env.TRACKS_PATH || './storage/tracks';
