import fs from 'node:fs';
import crypto from 'node:crypto';
import { resolveMediaTokenTtlSec } from './envConfig.js';

/** exp/sig 쿼리 기준 남은 유효 시간(초). 없으면 null */
export function signatureRemainingSec(query = {}) {
  const exp = Number(query?.exp);
  if (!Number.isFinite(exp)) return null;
  return Math.max(0, exp - Math.floor(Date.now() / 1000));
}

/**
 * 서명 URL 캐시 상한 — 서명 만료 전까지만 브라우저 캐시.
 * JWT 레거시(?token=)는 1시간 cap.
 */
export function mediaCacheMaxAgeSec(request, capSec = resolveMediaTokenTtlSec()) {
  const remaining = signatureRemainingSec(request?.query);
  const cap = Math.max(0, Math.floor(Number(capSec) || 7200));
  if (remaining != null) return Math.min(remaining, cap);
  return Math.min(3600, cap);
}

/** 비인증 스트림 프리뷰 */
export function previewCacheMaxAgeSec() {
  return 120;
}

/** HLS manifest — 큐 변경 가능 */
export function playlistManifestCacheMaxAgeSec() {
  return 60;
}

export function etagFromStat(stat) {
  if (!stat?.isFile?.()) return null;
  return `"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
}

export function etagFromString(body) {
  const hash = crypto.createHash('sha256').update(body).digest('hex').slice(0, 16);
  return `"${hash}"`;
}

export function tryStatFile(absolutePath) {
  try {
    const stat = fs.statSync(absolutePath);
    return stat.isFile() ? stat : null;
  } catch {
    return null;
  }
}

/** @returns {boolean} 304 응답을 보냈으면 true */
export function replyNotModifiedIfMatch(request, reply, etag) {
  if (!etag) return false;
  const raw = request.headers['if-none-match'];
  if (!raw) return false;
  const candidates = raw.split(',').map((s) => s.trim());
  if (!candidates.includes(etag) && !candidates.includes('*')) return false;
  reply.code(304).header('ETag', etag);
  return true;
}

export function setPrivateCacheControl(reply, maxAgeSec, { etag } = {}) {
  const age = Math.max(0, Math.floor(Number(maxAgeSec) || 0));
  const cc = age > 0 ? `private, max-age=${age}` : 'private, no-cache';
  reply.header('Cache-Control', cc);
  if (etag) reply.header('ETag', etag);
}

export function applyStreamCacheHeaders(request, reply, { fullAccess, filePath, rangeRequested = false }) {
  let etag = null;
  if (filePath) {
    const stat = tryStatFile(filePath);
    etag = etagFromStat(stat);
  }
  const maxAge = fullAccess ? mediaCacheMaxAgeSec(request) : previewCacheMaxAgeSec();

  if (!rangeRequested && replyNotModifiedIfMatch(request, reply, etag)) {
    setPrivateCacheControl(reply, maxAge, { etag });
    return { notModified: true, etag };
  }

  setPrivateCacheControl(reply, maxAge, { etag });
  return { notModified: false, etag };
}
