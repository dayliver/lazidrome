import fs from 'node:fs';
import path from 'node:path';
import { ulid } from 'ulid';
import { normalizeYoutubeInput } from '../lib/youtubeUrl.js';
import {
  buildDestDir,
  buildDestFilePath,
  assertInsideTracksRoot,
  sanitizePathSegment,
} from '../lib/pathSanitize.js';
import { buildFfmpegMetadataArgs } from '../lib/audioTags.js';
import { spawnCmd } from '../lib/spawnCmd.js';
import {
  resolveYtDlpBin,
  resolveFfmpegBin,
  ensureImportTempDir,
  TRACKS_PATH,
} from '../lib/importEnv.js';

function parseYtDlpJsonLines(stdout) {
  const lines = stdout.trim().split('\n').filter(Boolean);
  const out = [];
  for (const line of lines) {
    try {
      out.push(JSON.parse(line));
    } catch {
      // skip malformed
    }
  }
  return out;
}

function mapEntryToItem(entry, index) {
  const videoId = entry.id || entry.url?.match(/[?&]v=([^&]+)/)?.[1];
  return {
    videoId: videoId || `unknown-${index}`,
    title: entry.title || entry.fulltitle || `Track ${index + 1}`,
    artist: entry.artist || entry.uploader || entry.channel || null,
    album: entry.album || null,
    duration: entry.duration != null ? Number(entry.duration) : null,
    index: entry.playlist_index != null ? Number(entry.playlist_index) : index + 1,
    webpageUrl: entry.webpage_url || entry.url || null,
  };
}

/**
 * @param {string} url
 * @returns {Promise<{ type: string, sourceUrl: string, playlistTitle?: string, items: object[] }>}
 */
export async function resolveYoutubeUrl(url) {
  const norm = normalizeYoutubeInput(url);
  if (!norm) {
    throw new Error('유효한 YouTube URL이 아닙니다.');
  }

  const ytDlp = resolveYtDlpBin();
  const args = [
    '--flat-playlist',
    '--no-warnings',
    '-j',
    '--',
    norm.url,
  ];

  const { stdout, stderr, code } = await spawnCmd(ytDlp, args, { timeoutMs: 120_000 });
  if (code !== 0) {
    throw new Error(stderr?.trim() || stdout?.trim() || `yt-dlp exited with ${code}`);
  }

  const entries = parseYtDlpJsonLines(stdout);
  if (!entries.length) {
    throw new Error('YouTube에서 항목을 찾지 못했습니다.');
  }

  let playlistTitle = null;
  const first = entries[0];
  if (first.playlist_title) playlistTitle = first.playlist_title;

  const isPlaylist = norm.type === 'playlist' || entries.length > 1 || entries.some((e) => e.playlist_id);

  if (!isPlaylist && entries.length === 1) {
    const detailArgs = ['--no-warnings', '-j', '--', norm.url];
    const detail = await spawnCmd(ytDlp, detailArgs, { timeoutMs: 60_000 });
    if (detail.code === 0 && detail.stdout.trim()) {
      try {
        const full = JSON.parse(detail.stdout.trim().split('\n')[0]);
        return {
          type: 'video',
          sourceUrl: norm.url,
          items: [mapEntryToItem(full, 0)],
        };
      } catch {
        // fall through
      }
    }
    return {
      type: 'video',
      sourceUrl: norm.url,
      items: [mapEntryToItem(first, 0)],
    };
  }

  const items = entries
    .filter((e) => e.id || e.url)
    .map((e, i) => mapEntryToItem(e, i));

  return {
    type: 'playlist',
    sourceUrl: norm.url,
    playlistTitle: playlistTitle || undefined,
    items,
  };
}

function uniqueDestPath(destPath) {
  if (!fs.existsSync(destPath)) return destPath;
  const dir = path.dirname(destPath);
  const ext = path.extname(destPath);
  const base = path.basename(destPath, ext);
  let n = 2;
  while (fs.existsSync(path.join(dir, `${base} (${n})${ext}`))) n += 1;
  return path.join(dir, `${base} (${n})${ext}`);
}

/**
 * @param {{ videoId: string, webpageUrl?: string, sourceUrl?: string, tags: object, destDir?: string }} opts
 * @returns {Promise<{ destPath: string, title: string }>}
 */
export async function downloadOne(opts) {
  const { videoId, webpageUrl, sourceUrl, tags, destDir: destDirOverride } = opts;
  const ytDlp = resolveYtDlpBin();
  const ffmpeg = resolveFfmpegBin();
  const tempRoot = ensureImportTempDir();
  const workDir = path.join(tempRoot, ulid());
  fs.mkdirSync(workDir, { recursive: true });

  const watchUrl = webpageUrl || sourceUrl || `https://www.youtube.com/watch?v=${videoId}`;
  const destDir = destDirOverride || buildDestDir(TRACKS_PATH, {
    artist: tags.artist,
    album: tags.album,
  });
  fs.mkdirSync(destDir, { recursive: true });

  const title = sanitizePathSegment(tags.title, 'track');
  let destPath = buildDestFilePath(destDir, title);
  destPath = assertInsideTracksRoot(TRACKS_PATH, destPath);
  destPath = uniqueDestPath(destPath);

  const tempOut = path.join(workDir, 'audio.%(ext)s');

  try {
    const dlArgs = [
      '--no-warnings',
      '-f', 'bestaudio/best',
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '-o', tempOut,
      '--',
      watchUrl,
    ];
    const dl = await spawnCmd(ytDlp, dlArgs, { cwd: workDir, timeoutMs: 600_000 });
    if (dl.code !== 0) {
      throw new Error(dl.stderr?.trim() || dl.stdout?.trim() || 'yt-dlp download failed');
    }

    const files = fs.readdirSync(workDir).filter((f) => /\.(mp3|m4a|opus|webm|ogg)$/i.test(f));
    if (!files.length) {
      throw new Error('다운로드된 오디오 파일을 찾지 못했습니다.');
    }
    const downloaded = path.join(workDir, files[0]);

    const metaArgs = buildFfmpegMetadataArgs({
      title: tags.title,
      artist: tags.artist,
      album: tags.album,
      albumArtist: tags.albumArtist ?? tags.artist,
      trackNo: tags.trackNo,
    });

    const ffArgs = ['-y', '-i', downloaded, ...metaArgs, '-codec:a', 'libmp3lame', '-qscale:a', '2', destPath];
    const ff = await spawnCmd(ffmpeg, ffArgs, { timeoutMs: 300_000 });
    if (ff.code !== 0) {
      // ffmpeg 실패 시 yt-dlp mp3를 그대로 이동
      if (!downloaded.endsWith('.mp3')) {
        throw new Error(ff.stderr?.trim() || 'ffmpeg conversion failed');
      }
      fs.copyFileSync(downloaded, destPath);
    }

    return { destPath, title: tags.title || title };
  } finally {
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

export { buildDestDir, TRACKS_PATH };
