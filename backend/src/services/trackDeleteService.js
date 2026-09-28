import fs from 'node:fs';
import path from 'node:path';
import { findTrackForDelete, deleteTrackFiledataById } from '../repositories/trackRepository.js';
import { cleanupOrphans } from '../lib/orphanCleanup.js';
import { bumpLibraryRevisionNow } from '../lib/libraryRevision.js';
import { resolveTrackFilePath } from '../lib/trackPath.js';
import { assertInsideTracksRoot } from '../lib/pathSanitize.js';
import { TRACKS_PATH } from '../lib/importEnv.js';

const IMAGES_PATH = process.env.IMAGES_PATH || './storage/images';

function removeIfExists(filePath) {
  if (!filePath) return false;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch (err) {
    console.error(`❌ 파일 삭제 실패 ${filePath}:`, err.message);
  }
  return false;
}

function removeTrackCoverFile(trackId, coverType) {
  if (!trackId || !coverType) return;
  removeIfExists(path.join(IMAGES_PATH, 'tracks', `${trackId}${coverType}`));
}

/** TRACKS_PATH 안의 오디오만 디스크에서 지운다. 밖이면 건너뛴다. */
function removeAudioFile(storedPath) {
  if (!storedPath) return false;
  try {
    const resolved = resolveTrackFilePath(storedPath, TRACKS_PATH);
    const abs = assertInsideTracksRoot(TRACKS_PATH, path.resolve(resolved));
    return removeIfExists(abs);
  } catch {
    return false;
  }
}

/**
 * 트랙을 라이브러리에서 삭제한다.
 * - 커스텀 커버·오디오 파일(TRACKS_PATH 내부) 제거
 * - track_filedata 삭제(메타·교차 테이블 CASCADE)
 * - 빈 앨범·고아 아티스트 정리
 */
export function deleteTrack(id) {
  const track = findTrackForDelete(id);
  if (!track) {
    const err = new Error('Not found: track');
    err.statusCode = 404;
    throw err;
  }

  removeTrackCoverFile(track.id, track.custom_cover_type);
  removeAudioFile(track.path);
  deleteTrackFiledataById(track.fileId);

  let orphans = { albumsRemoved: 0, artistsRemoved: 0, artistsMerged: 0 };
  try {
    orphans = cleanupOrphans();
  } catch (err) {
    console.error('❌ orphan 정리 중 오류:', err?.message || err);
  }

  bumpLibraryRevisionNow();
  return {
    id: track.id,
    deleted: true,
    title: track.title,
    albumsRemoved: orphans.albumsRemoved,
    artistsRemoved: orphans.artistsRemoved,
  };
}
