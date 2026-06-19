/**
 * ffmpeg -metadata 인자 배열 생성 (key=value 쌍을 -metadata로 펼침)
 * @param {{ title?: string, artist?: string, album?: string, albumArtist?: string, trackNo?: number | string }} tags
 * @returns {string[]}
 */
export function buildFfmpegMetadataArgs(tags = {}) {
  const args = [];
  const map = {
    title: tags.title,
    artist: tags.artist,
    album: tags.album,
    album_artist: tags.albumArtist ?? tags.artist,
  };
  if (tags.trackNo != null && tags.trackNo !== '') {
    map.track = String(tags.trackNo);
  }
  for (const [key, val] of Object.entries(map)) {
    const v = String(val ?? '').trim();
    if (!v) continue;
    args.push('-metadata', `${key}=${v}`);
  }
  return args;
}
