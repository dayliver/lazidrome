// lib/image.js
/**
 * 앨범, 아티스트, 트랙의 이미지 URL (단기 서명 쿼리 exp/sig).
 * @param {string} baseUrl - authStore.serverUrl
 * @param {string} type - 'album' | 'artist' | 'track' | 'playlist' | 'tag'
 * @param {string} id
 * @param {string} mediaQuery - `exp=...&sig=...` (auth store에서 발급)
 */
export function getCoverUrl(baseUrl, type, id, mediaQuery) {
  if (!id || !mediaQuery) return '';
  if (type === 'tag') {
    return `${baseUrl}/api/images/tag?name=${encodeURIComponent(id)}&${mediaQuery}`;
  }
  return `${baseUrl}/api/images/${type}/${id}?${mediaQuery}`;
}