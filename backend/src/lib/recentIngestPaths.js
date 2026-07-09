import path from 'node:path';

const TTL_MS = 45_000;
/** @type {Map<string, number>} */
const completedAt = new Map();

function normalizeKey(filePath) {
  return path.resolve(String(filePath));
}

/** 스캔·커밋 직후 동일 경로에 대한 중복 chokidar 처리 방지 */
export function markScanCompleted(filePath) {
  completedAt.set(normalizeKey(filePath), Date.now() + TTL_MS);
}

export function shouldSkipRecentScan(filePath) {
  const key = normalizeKey(filePath);
  const expires = completedAt.get(key);
  if (!expires) return false;
  if (Date.now() > expires) {
    completedAt.delete(key);
    return false;
  }
  return true;
}

export function markPathsForScanSkip(filePaths) {
  for (const p of filePaths) {
    if (p) markScanCompleted(p);
  }
}
