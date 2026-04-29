import fs from 'node:fs';
import { findTrackFileInfo } from '../repositories/streamRepository.js';

/** 비인증 스트림 미리보기 길이(초). fluent-ffmpeg 없이 파일 비율로 바이트 상한 계산 */
export const DEFAULT_STREAM_PREVIEW_SECONDS = 10;

// 1. 파일 정보 및 물리 파일 존재 여부 확인
export function getTrackPhysicalFile(id) {
  const fileInfo = findTrackFileInfo(id);
  if (!fileInfo || !fs.existsSync(fileInfo.path)) {
    return null; // DB에 없거나 실제 파일이 지워진 경우
  }
  return fileInfo;
}

/**
 * 전체 파일 대비 duration·size 비율로 previewSec 초에 해당하는 마지막 바이트 인덱스(포함).
 * VBR 등으로 시각과 정확히 일치하진 않음.
 */
export function getPreviewMaxByteIndex(fileSize, durationSec, previewSec = DEFAULT_STREAM_PREVIEW_SECONDS) {
  const size = Number(fileSize);
  if (!Number.isFinite(size) || size <= 0) return 0;
  const last = size - 1;
  const d = Number(durationSec);
  if (!Number.isFinite(d) || d <= 0) {
    return Math.min(last, 256 * 1024 - 1);
  }
  if (d <= previewSec) return last;
  const previewBytes = Math.max(1, Math.floor((previewSec / d) * size));
  return Math.min(previewBytes - 1, last);
}

/**
 * Range/전체 스트림용: start/end를 비인증 시 previewMax 이하로 제한.
 * start > previewMax 이면 null (416 등 처리).
 */
export function clampByteRangeForPreview(start, end, previewMaxInclusive, fileSize) {
  const last = fileSize - 1;
  const cap = Math.min(previewMaxInclusive, last);
  if (start > cap) return null;
  const e = Math.min(end, cap, last);
  const chunksize = e - start + 1;
  return { start, end: e, chunksize, effectiveTotal: cap + 1 };
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