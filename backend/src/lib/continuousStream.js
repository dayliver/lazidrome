import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { resolveFfmpegBin } from './importEnv.js';

/** Concurrent continuous ffmpeg pipes (per process). */
const MAX_ACTIVE = Math.max(1, Number(process.env.CONTINUOUS_STREAM_MAX) || 3);
/** Output bitrate for the joined MP3 pipe. */
const BITRATE = String(process.env.CONTINUOUS_STREAM_BITRATE || '192k').trim() || '192k';

let activeStreams = 0;

export function continuousStreamSlotsAvailable() {
  return activeStreams < MAX_ACTIVE;
}

export function continuousStreamActiveCount() {
  return activeStreams;
}

/**
 * ffmpeg concat demuxer line — paths with spaces/quotes must be single-quoted.
 * @param {string} filePath absolute path
 */
export function formatConcatFileLine(filePath) {
  const abs = path.resolve(String(filePath));
  const escaped = abs.replace(/'/g, "'\\''");
  return `file '${escaped}'\n`;
}

/**
 * @param {string[]} absolutePaths
 * @returns {string}
 */
export function buildConcatListBody(absolutePaths) {
  return absolutePaths.map(formatConcatFileLine).join('');
}

/**
 * Write a temp concat list and spawn ffmpeg → MP3 on stdout.
 * Caller must invoke the returned cleanup (also runs on process exit/close).
 *
 * @param {string[]} absolutePaths
 * @returns {{ child: import('node:child_process').ChildProcess, listPath: string, cleanup: () => void }}
 */
export function spawnContinuousMp3Pipe(absolutePaths) {
  if (!absolutePaths?.length) {
    throw new Error('CONTINUOUS_NO_INPUTS');
  }
  if (!continuousStreamSlotsAvailable()) {
    throw new Error('CONTINUOUS_BUSY');
  }

  const listPath = path.join(
    os.tmpdir(),
    `lazidrome-concat-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`,
  );
  fs.writeFileSync(listPath, buildConcatListBody(absolutePaths), 'utf8');

  const ffmpeg = resolveFfmpegBin();
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    listPath,
    '-vn',
    '-c:a',
    'libmp3lame',
    '-b:a',
    BITRATE,
    '-ar',
    '44100',
    '-ac',
    '2',
    '-f',
    'mp3',
    'pipe:1',
  ];

  activeStreams += 1;
  const child = spawn(ffmpeg, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    activeStreams = Math.max(0, activeStreams - 1);
    try {
      if (!child.killed) child.kill('SIGKILL');
    } catch {
      /* ignore */
    }
    try {
      fs.unlinkSync(listPath);
    } catch {
      /* ignore */
    }
  };

  child.on('close', cleanup);
  child.on('error', cleanup);

  return { child, listPath, cleanup };
}

export { MAX_ACTIVE as CONTINUOUS_STREAM_MAX, BITRATE as CONTINUOUS_STREAM_BITRATE };
