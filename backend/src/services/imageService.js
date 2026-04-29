import path from 'node:path';
import fs from 'node:fs';
import {
  findAlbumCoverType,
  findTrackCoverInfo,
  findArtistCoverType,
  findPlaylistCoverType,
  findRepresentativeTrackIdForAlbum
} from '../repositories/imageRepository.js';

const IMAGES_PATH = process.env.IMAGES_PATH || './storage/images';

// 💡 내부 헬퍼: 파일 존재 여부 검사
function fileExists(subDir, fileName) {
  return fs.existsSync(path.join(IMAGES_PATH, subDir, fileName));
}

// ==========================================
// 도메인별 이미지 경로 해석기 (Resolvers)
// ==========================================

/**
 * 앨범 전용 이미지 URL.
 * DB의 cover_type만 보던 기존 로직은, 트랙 API가 커스텀/앨범 연쇄로 찾는 경우와 불일치할 수 있어
 * (프로덕션에서 AlbumDetail만 비는 현상) 파일·대표 트랙 순으로 폴백합니다.
 */
export function resolveAlbumImage(id) {
  const album = findAlbumCoverType(id);
  if (album?.cover_type) {
    const fileName = `${id}${album.cover_type}`;
    if (fileExists('albums', fileName)) return `albums/${fileName}`;
  }
  const exts = ['.jpg', '.jpeg', '.png', '.webp'];
  for (const ext of exts) {
    const fileName = `${id}${ext}`;
    if (fileExists('albums', fileName)) return `albums/${fileName}`;
  }
  const row = findRepresentativeTrackIdForAlbum(id);
  if (row?.id) {
    const viaTrack = resolveTrackImage(row.id);
    if (viaTrack) return viaTrack;
  }
  return null;
}

export function resolveTrackImage(id) {
  const track = findTrackCoverInfo(id);
  if (track?.custom_cover_type) {
    const fileName = `${id}${track.custom_cover_type}`;
    if (fileExists('tracks', fileName)) return `tracks/${fileName}`;
  }
  if (track?.album_id && track?.album_cover_type) {
    const fileName = `${track.album_id}${track.album_cover_type}`;
    if (fileExists('albums', fileName)) return `albums/${fileName}`;
  }
  return null;
}

export function resolveArtistImage(id) {
  const artist = findArtistCoverType(id);
  if (artist?.cover_type) {
    const fileName = `${id}${artist.cover_type}`;
    if (fileExists('artists', fileName)) return `artists/${fileName}`;
  }
  return null;
}

export function resolvePlaylistImage(id) {
  const playlist = findPlaylistCoverType(id);
  if (playlist?.cover_type) {
    // 플레이리스트 확장자에 점(.)이 없는 경우를 대비한 방어 로직
    const ext = playlist.cover_type.startsWith('.') ? playlist.cover_type : `.${playlist.cover_type}`;
    const fileName = `${id}${ext}`; 
    if (fileExists('playlists', fileName)) return `playlists/${fileName}`;
  }
  return null;
}

/** 태그 커버: storage/images/tags/{name}.jpg (이름에 /, \\, .. 불가) */
export function resolveTagImage(tagName) {
  const decoded = decodeURIComponent(String(tagName || '').trim());
  if (!decoded || decoded.includes('..') || /[/\\]/.test(decoded)) return null;
  const fileName = `${decoded}.jpg`;
  const absBase = path.resolve(IMAGES_PATH, 'tags');
  const absFile = path.resolve(IMAGES_PATH, 'tags', fileName);
  if (!absFile.startsWith(absBase)) return null;
  if (fs.existsSync(absFile)) return path.join('tags', fileName).replace(/\\/g, '/');
  return null;
}

// 💡 에러 방어용 기본 이미지 반환
export function getDefaultImage() {
  if (fs.existsSync(path.join(IMAGES_PATH, 'default.png'))) {
    return 'default.png';
  }
  return null;
}