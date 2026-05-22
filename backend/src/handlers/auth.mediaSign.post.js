import { mediaResourceKey, signMediaResource } from '../lib/mediaSign.js';

const MAX_BATCH = 80;

function normalizeResource(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.kind === 'stream' && raw.id) {
    return { kind: 'stream', id: String(raw.id) };
  }
  if (raw.kind === 'image' && raw.imageType === 'tag' && raw.name) {
    return { kind: 'image', imageType: 'tag', name: String(raw.name) };
  }
  if (raw.kind === 'image' && raw.imageType && raw.id) {
    return { kind: 'image', imageType: String(raw.imageType), id: String(raw.id) };
  }
  return null;
}

export function createMediaSignHandler(jwtSecret, ttlSeconds) {
  return async function mediaSignHandler(request, reply) {
    const body = request.body ?? {};
    const list = Array.isArray(body.resources) ? body.resources : [];
    if (list.length === 0) {
      return reply.code(400).send({ error: 'resources 배열이 필요합니다.' });
    }
    if (list.length > MAX_BATCH) {
      return reply.code(400).send({ error: `한 번에 최대 ${MAX_BATCH}개까지 서명할 수 있습니다.` });
    }

    const signatures = {};
    for (const item of list) {
      const resource = normalizeResource(item);
      if (!resource) continue;
      const key = mediaResourceKey(resource);
      const { exp, sig } = signMediaResource(resource, jwtSecret, ttlSeconds);
      signatures[key] = { exp, sig };
    }

    return {
      ttlSeconds,
      signatures,
    };
  };
}
