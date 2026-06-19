const ALLOWED_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
]);

/**
 * @param {string} raw
 * @returns {boolean}
 */
export function isYoutubeUrl(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return false;
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const host = u.hostname.toLowerCase().replace(/\.$/, '');
    return ALLOWED_HOSTS.has(host);
  } catch {
    return false;
  }
}

/**
 * @param {string} raw
 * @returns {'video' | 'playlist' | 'unknown'}
 */
export function classifyYoutubeUrl(raw) {
  try {
    const u = new URL(String(raw).trim());
    const host = u.hostname.toLowerCase();
    const list = u.searchParams.get('list');
    const v = u.searchParams.get('v');

    if (host === 'youtu.be') return 'video';
    if (list) return 'playlist';
    if (u.pathname.startsWith('/playlist')) return 'playlist';
    if (u.pathname === '/watch' && v) return 'video';
    if (u.pathname.startsWith('/shorts/')) return 'video';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}
