/** 서버 `track_metadata.play_count` 등 숫자 필드 정규화 */
export function playCount(track) {
  const n = Number(track?.play_count)
  return Number.isFinite(n) ? n : 0
}
