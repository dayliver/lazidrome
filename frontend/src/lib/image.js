// lib/image.js
/**
 * 앨범, 아티스트, 트랙의 이미지 URL을 생성합니다.
 * @param {string} baseUrl - authStore.serverUrl
 * @param {string} type - 'album' | 'artist' | 'track'
 * @param {string} id - 고유 ID (ULID)
 * @param {string} token - authStore.token
 * @returns {string} 완성된 API URL
 */
export function getCoverUrl(baseUrl, type, id, token) {
  if (!id) return '';
  return `${baseUrl}/api/images/${type}/${id}?token=${token}`;
}