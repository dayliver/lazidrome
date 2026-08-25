import path from 'node:path';
import {
  resolveAlbumImage,
  resolveTrackImage,
  resolveArtistImage,
  resolvePlaylistImage,
  resolveTagImage,
  getDefaultImage,
} from '../services/imageService.js';
import {
  mediaCacheMaxAgeSec,
  tryStatFile,
  etagFromStat,
  replyNotModifiedIfMatch,
  setPrivateCacheControl,
} from '../lib/httpCache.js';

const IMAGES_PATH = process.env.IMAGES_PATH || './storage/images';

function sendImageResponse(request, reply, relativePath) {
  reply.header('Access-Control-Allow-Origin', '*');
  reply.header('Cross-Origin-Resource-Policy', 'cross-origin');

  const serveRelative = relativePath || getDefaultImage();
  if (!serveRelative) {
    return reply.code(404).send({ error: 'Image not found' });
  }

  const absPath = path.resolve(IMAGES_PATH, serveRelative);
  const stat = tryStatFile(absPath);
  const etag = etagFromStat(stat);
  const maxAge = mediaCacheMaxAgeSec(request);

  if (replyNotModifiedIfMatch(request, reply, etag)) {
    setPrivateCacheControl(reply, maxAge, { etag });
    return reply.send();
  }

  setPrivateCacheControl(reply, maxAge, { etag });
  // @fastify/static은 기본적으로 자기 Cache-Control(`public, max-age=0`)과 약한 ETag를
  // 덧씌운다. 그대로 두면 위에서 만든 서명 기반 private 캐시가 통째로 무시되고
  // (커버가 전혀 캐시되지 않음), 클라이언트가 돌려주는 ETag도 우리 것과 달라
  // 조건부 요청이 우리 쪽에서 매칭되지 않는다.
  return reply.sendFile(serveRelative, {
    cacheControl: false,
    etag: false,
    lastModified: false,
  });
}

export async function getAlbumImageHandler(request, reply) {
  const { id } = request.params;
  const imagePath = resolveAlbumImage(id);
  return sendImageResponse(request, reply, imagePath);
}

export async function getTrackImageHandler(request, reply) {
  const { id } = request.params;
  const imagePath = resolveTrackImage(id);
  return sendImageResponse(request, reply, imagePath);
}

export async function getArtistImageHandler(request, reply) {
  const { id } = request.params;
  const imagePath = resolveArtistImage(id);
  return sendImageResponse(request, reply, imagePath);
}

export async function getPlaylistImageHandler(request, reply) {
  const { id } = request.params;
  const imagePath = resolvePlaylistImage(id);
  return sendImageResponse(request, reply, imagePath);
}

export async function getTagImageHandler(request, reply) {
  const name = request.query.name;
  if (!name || typeof name !== 'string') {
    return reply.code(400).send({ error: 'name query is required' });
  }
  const imagePath = resolveTagImage(name);
  return sendImageResponse(request, reply, imagePath);
}
