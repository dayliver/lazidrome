import fs from 'node:fs';
import { findTrackFileInfo } from '../repositories/streamRepository.js';

// 1. 파일 정보 및 물리 파일 존재 여부 확인
export function getTrackPhysicalFile(id) {
  const fileInfo = findTrackFileInfo(id);
  if (!fileInfo || !fs.existsSync(fileInfo.path)) {
    return null; // DB에 없거나 실제 파일이 지워진 경우
  }
  return fileInfo;
}

// 2. 오디오 포맷에 따른 MIME 타입 매핑
export function getContentType(format) {
  const mimeTypes = {
    mp3: 'audio/mpeg',
    flac: 'audio/flac',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
    ogg: 'audio/ogg'
  };
  return mimeTypes[format?.toLowerCase()] || 'application/octet-stream';
}

// 3. 부분 재생(Range) 요청 시 시작/끝/크기 계산
export function parseRange(rangeHeader, fileSize) {
  if (!rangeHeader) return null;
  
  const parts = rangeHeader.replace(/bytes=/, "").split("-");
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
  const chunksize = (end - start) + 1;
  
  return { start, end, chunksize };
}