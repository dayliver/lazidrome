import fs from 'node:fs';
import path from 'node:path';
import { spawnCmd } from './spawnCmd.js';
import { buildFfmpegMetadataArgs } from './audioTags.js';
import { resolveFfmpegBin } from './importEnv.js';

/** 확장자별 ffmpeg 출력 옵션 (태그 반영 신뢰도 우선) */
function outputCodecArgs(ext) {
  switch (ext.toLowerCase()) {
    case '.mp3':
      return ['-codec:a', 'libmp3lame', '-qscale:a', '2'];
    case '.flac':
      return ['-codec:a', 'flac'];
    case '.ogg':
      return ['-codec:a', 'libvorbis'];
    case '.opus':
      return ['-codec:a', 'libopus'];
    case '.m4a':
    case '.mp4':
      return ['-codec:a', 'copy', '-movflags', 'use_metadata_tags'];
    case '.wav':
      return ['-codec:a', 'pcm_s16le'];
    default:
      return ['-codec:a', 'copy'];
  }
}

/**
 * 소스 파일을 destPath에 저장하면서 ID3/Vorbis 등 태그를 덮어씀.
 * @returns {Promise<boolean>} 태그 포함 저장 성공 여부
 */
export async function writeAudioFileWithTags(sourcePath, destPath, tags) {
  const ffmpeg = resolveFfmpegBin();
  const ext = path.extname(destPath);
  const tmpPath = `${destPath}.tagging${ext}`;
  const metaArgs = buildFfmpegMetadataArgs({
    title: tags.title,
    artist: tags.artist,
    album: tags.album,
    albumArtist: tags.albumArtist ?? tags.artist,
    trackNo: tags.trackNo,
  });

  const ffArgs = [
    '-y',
    '-i', sourcePath,
    '-vn',
    '-map', '0:a:0?',
    '-map_metadata', '-1',
    ...metaArgs,
    ...outputCodecArgs(ext),
    tmpPath,
  ];

  try {
    const ff = await spawnCmd(ffmpeg, ffArgs, { timeoutMs: 300_000 });
    if (ff.code === 0 && fs.existsSync(tmpPath)) {
      fs.renameSync(tmpPath, destPath);
      return true;
    }
    console.warn('[writeAudioTags] ffmpeg failed:', (ff.stderr || ff.stdout || '').trim().slice(-400));
  } catch (err) {
    console.warn('[writeAudioTags] ffmpeg error:', err?.message || err);
  }

  if (fs.existsSync(tmpPath)) {
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      /* ignore */
    }
  }
  return false;
}
