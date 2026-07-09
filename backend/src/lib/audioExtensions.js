import path from 'node:path';

/** 스캔·업로드·파일 브라우저에서 공통으로 쓰는 오디오 확장자 */
export const AUDIO_EXTENSIONS = Object.freeze([
  '.mp3',
  '.flac',
  '.m4a',
  '.aac',
  '.ogg',
  '.opus',
  '.wav',
  '.wma',
  '.ape',
  '.alac',
]);

export const AUDIO_EXT_SET = new Set(AUDIO_EXTENSIONS);

/** ffprobe/music-metadata로 파싱 가능한 최소 파일 크기 */
export const MIN_AUDIO_BYTES = 1024;

/**
 * @param {string} ext
 */
export function isAudioExtension(ext) {
  return AUDIO_EXT_SET.has(String(ext || '').toLowerCase());
}

/**
 * @param {string} filePath
 */
export function isAudioFilePath(filePath) {
  return isAudioExtension(path.extname(filePath));
}
