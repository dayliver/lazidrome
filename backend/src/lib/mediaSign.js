import crypto from 'node:crypto';

const VERSION = '1';

/** @typedef {{ kind: 'stream', id: string } | { kind: 'image', imageType: string, id?: string, name?: string }} MediaResource */

export function mediaResourceKey(resource) {
  if (resource.kind === 'stream') {
    return `stream:${String(resource.id)}`;
  }
  if (resource.kind === 'image') {
    if (resource.imageType === 'tag') {
      return `image:tag:${String(resource.name ?? '')}`;
    }
    return `image:${resource.imageType}:${String(resource.id ?? '')}`;
  }
  throw new Error('Invalid media resource');
}

export function parseMediaResourceFromRequest(request) {
  const path = request.routeOptions?.url ?? request.routerPath ?? '';
  const params = request.params ?? {};
  const query = request.query ?? {};

  if (path === '/api/stream/:id' && params.id) {
    return { kind: 'stream', id: String(params.id) };
  }
  if (path === '/api/images/album/:id' && params.id) {
    return { kind: 'image', imageType: 'album', id: String(params.id) };
  }
  if (path === '/api/images/track/:id' && params.id) {
    return { kind: 'image', imageType: 'track', id: String(params.id) };
  }
  if (path === '/api/images/artist/:id' && params.id) {
    return { kind: 'image', imageType: 'artist', id: String(params.id) };
  }
  if (path === '/api/images/playlist/:id' && params.id) {
    return { kind: 'image', imageType: 'playlist', id: String(params.id) };
  }
  if (path === '/api/images/tag' && query.name) {
    return { kind: 'image', imageType: 'tag', name: String(query.name) };
  }
  return null;
}

export function signMediaResource(resource, secret, ttlSeconds) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const key = mediaResourceKey(resource);
  const payload = `${VERSION}|${key}|${exp}`;
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return { exp, sig, key, ttlSeconds };
}

export function verifyMediaSignature(query, resource, secret) {
  const expRaw = query?.exp;
  const sigRaw = query?.sig;
  if (expRaw == null || sigRaw == null) return false;

  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;

  const key = mediaResourceKey(resource);
  const payload = `${VERSION}|${key}|${exp}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');

  const a = Buffer.from(String(sigRaw), 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function mediaQueryString({ exp, sig }) {
  return `exp=${exp}&sig=${encodeURIComponent(sig)}`;
}
