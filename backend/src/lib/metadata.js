import * as mm from 'music-metadata';
import path from 'node:path';
import { normalizeTagString } from './artistTags.js';

/**
 * 음원 파일의 메타데이터를 파싱합니다.
 */
export async function parseMetadata(filePath) {
  const metadata = await mm.parseFile(filePath);
  const { common, format } = metadata;

  const artistStr = normalizeTagString(common.artist).trim();

  return {
    title: common.title || path.basename(filePath, path.extname(filePath)),
    artist: artistStr.length ? artistStr : null,
    album: common.album || 'Unknown Album',
    duration: format.duration || 0,
    bitrate: format.bitrate || 0,
    format: path.extname(filePath).replace('.', ''),
    // 장르가 있다면 태그 배열로 변환
    tags: common.genre ? JSON.stringify(common.genre) : JSON.stringify([])
  };
}