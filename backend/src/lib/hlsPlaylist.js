import { mediaQueryString, signMediaResource } from './mediaSign.js';

const MAX_PLAYLIST_TRACKS = 48;

/**
 * @param {string} baseUrl origin without trailing slash e.g. https://host
 * @param {{ id: string, duration_sec?: number, title?: string }[]} tracks
 * @param {(trackId: string) => string} signQueryForTrack
 */
export function buildVodPlaylist(baseUrl, tracks, signQueryForTrack) {
  if (!tracks?.length) {
    return '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-ENDLIST\n';
  }

  let targetDuration = 1;
  const segmentLines = [];

  for (const track of tracks) {
    const id = String(track.id);
    const rawDur = Number(track.duration_sec);
    const duration = Number.isFinite(rawDur) && rawDur > 0 ? rawDur : 1;
    targetDuration = Math.max(targetDuration, Math.ceil(duration));
    const title = String(track.title || '').replace(/[\r\n,]/g, ' ').slice(0, 120);
    const mediaQuery = signQueryForTrack(id);
    const streamUrl = `${baseUrl}/api/stream/${encodeURIComponent(id)}?${mediaQuery}`;
    segmentLines.push(`#EXTINF:${duration.toFixed(3)},${title}`);
    segmentLines.push(streamUrl);
  }

  const lines = [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    `#EXT-X-TARGETDURATION:${targetDuration}`,
    '#EXT-X-PLAYLIST-TYPE:VOD',
    '#EXT-X-MEDIA-SEQUENCE:0',
    '#EXT-X-INDEPENDENT-SEGMENTS',
    ...segmentLines,
    '#EXT-X-ENDLIST',
  ];
  return `${lines.join('\n')}\n`;
}

export function signStreamQuery(trackId, secret, ttlSeconds) {
  const { exp, sig } = signMediaResource({ kind: 'stream', id: String(trackId) }, secret, ttlSeconds);
  return mediaQueryString({ exp, sig });
}

export function parsePlaylistTrackIds(raw) {
  if (!raw || typeof raw !== 'string') return [];
  const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const unique = [];
  const seen = new Set();
  for (const id of parts) {
    if (id.length > 80) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
    if (unique.length >= MAX_PLAYLIST_TRACKS) break;
  }
  return unique;
}

export { MAX_PLAYLIST_TRACKS };
