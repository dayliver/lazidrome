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
  return reply.sendFile(serveRelative);
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
