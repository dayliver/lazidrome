const ALLOWED_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
]);

/**
 * @param {string} raw
 * @returns {URL | null}
 */
export function parseYoutubeUrl(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    const host = u.hostname.toLowerCase().replace(/\.$/, '');
    if (!ALLOWED_HOSTS.has(host)) return null;
    return u;
  } catch {
    return null;
  }
}

/**
 * @param {string} raw
 * @returns {boolean}
 */
export function isYoutubeUrl(raw) {
  return parseYoutubeUrl(raw) != null;
}

/**
 * @param {URL} u
 * @returns {'video' | 'playlist' | 'unknown'}
 */
export function classifyYoutubeUrl(u) {
  const host = u.hostname.toLowerCase();
  const path = u.pathname;

  if (host === 'youtu.be') {
    const id = path.replace(/^\//, '').split('/')[0];
    return id ? 'video' : 'unknown';
  }

  const list = u.searchParams.get('list');
  const v = u.searchParams.get('v');

  if (list && !v) return 'playlist';
  if (list && v) return 'playlist';
  if (path === '/watch' && v) return 'video';
  if (path.startsWith('/playlist')) return 'playlist';
  if (path.startsWith('/shorts/')) return 'video';

  return 'unknown';
}

/**
 * @param {string} raw
 * @returns {{ url: string, type: 'video' | 'playlist' | 'unknown', videoId?: string, playlistId?: string } | null}
 */
export function normalizeYoutubeInput(raw) {
  const u = parseYoutubeUrl(raw);
  if (!u) return null;

  const type = classifyYoutubeUrl(u);
  const videoId = u.searchParams.get('v') || (u.hostname === 'youtu.be' ? u.pathname.slice(1).split('/')[0] : null);
  const playlistId = u.searchParams.get('list') || (u.pathname.startsWith('/playlist') ? u.pathname.split('/').pop() : null);

  return {
    url: u.href,
    type,
    videoId: videoId || undefined,
    playlistId: playlistId || undefined,
  };
}
