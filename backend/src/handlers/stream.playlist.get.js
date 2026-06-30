import {
  buildVodPlaylist,
  parsePlaylistTrackIds,
  signStreamQuery,
} from '../lib/hlsPlaylist.js';
import { findTracksPlaylistMetaByIds } from '../repositories/streamRepository.js';

function requestPublicOrigin(request) {
  const proto = String(request.headers['x-forwarded-proto'] || request.protocol || 'http').split(',')[0].trim();
  const host = String(request.headers['x-forwarded-host'] || request.headers.host || 'localhost').split(',')[0].trim();
  return `${proto}://${host}`;
}

export function createStreamPlaylistHandler(mediaSecret, mediaTtlSec) {
  return async function streamPlaylistHandler(request, reply) {
    const ids = parsePlaylistTrackIds(request.query?.ids);
    if (!ids.length) {
      return reply.code(400).send({ error: 'ids query required (comma-separated track ids)' });
    }

    const tracks = findTracksPlaylistMetaByIds(ids);
    if (!tracks.length) {
      return reply.code(404).send({ error: 'No playable tracks found for ids' });
    }

    const baseUrl = requestPublicOrigin(request);
    const ttl = Number(mediaTtlSec) > 0 ? Number(mediaTtlSec) : 7200;
    const body = buildVodPlaylist(baseUrl, tracks, (trackId) =>
      signStreamQuery(trackId, mediaSecret, ttl),
    );

    return reply
      .code(200)
      .header('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8')
      .header('Cache-Control', 'private, max-age=60')
      .send(body);
  };
}
