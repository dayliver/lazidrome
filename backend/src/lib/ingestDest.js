import fs from 'node:fs';
import path from 'node:path';
import {
  buildDestDir,
  buildTrackFileName,
  uniqueDestPath,
  assertInsideTracksRoot,
} from './pathSanitize.js';
import { TRACKS_PATH } from './importEnv.js';
import { markPathsForScanSkip } from './recentIngestPaths.js';

/**
 * 라이브러리(TRACKS_PATH) 안에 Artist/Album/Artist - Album - Title.ext 경로를 만든다.
 * Upload·YouTube·교체가 같은 파일명 규칙을 쓰도록 한다.
 * @param {{ artist?: string, album?: string, title?: string, ext?: string }} tags
 * @returns {string} absolute unique dest path
 */
export function resolveLibraryAudioDest(tags = {}) {
  const ext = tags.ext || '.mp3';
  const destDir = buildDestDir(TRACKS_PATH, {
    artist: tags.artist,
    album: tags.album,
  });
  fs.mkdirSync(destDir, { recursive: true });
  const fileName = buildTrackFileName({
    artist: tags.artist,
    album: tags.album,
    title: tags.title,
    ext,
  });
  let destPath = path.join(destDir, fileName);
  destPath = assertInsideTracksRoot(TRACKS_PATH, destPath);
  return uniqueDestPath(destPath);
}

/** 디스크에 쓴 직후 chokidar 중복 스캔을 막는다. */
export function noteIngestedPaths(...filePaths) {
  markPathsForScanSkip(filePaths.filter(Boolean));
}
