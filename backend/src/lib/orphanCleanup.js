/**
 * 라이브러리 정리(고아 레코드 제거).
 *
 * - 트랙이 0인 앨범 → 앨범 행과 album_artists 링크, 디스크 커버 파일까지 제거
 * - 트랙이 0인 아티스트(앨범에만 묶인 경우 포함) → 아티스트 행과 커버 파일 제거
 * - 동일 이름(대소문자 무시) 아티스트 중복 → 하나로 병합
 *
 * 스캐너의 파일 unlink, 사용자가 일괄 정리 실행 시 모두 동일 로직을 사용한다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { getDB } from '../db.js';
import { pruneOrphanVisits } from '../repositories/pageVisitsRepository.js';
import { mergeDuplicateArtistsByName } from './artistDedup.js';

export { mergeDuplicateArtistsByName } from './artistDedup.js';

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

function removeAlbumCoverFile(albumId, coverType) {
  if (!albumId || !coverType) return;
  const file = path.join(IMAGES_PATH, 'albums', `${albumId}${coverType}`);
  removeIfExists(file);
}

function removeArtistCoverFile(artistId, coverType) {
  if (!artistId || !coverType) return;
  const file = path.join(IMAGES_PATH, 'artists', `${artistId}${coverType}`);
  removeIfExists(file);
}

/** 트랙 링크가 0인 앨범 후보를 찾는다. */
export function findEmptyAlbums(limit = 500) {
  const db = getDB();
  return db
    .prepare(
      `
      SELECT a.id, a.name, a.year, a.cover_type
      FROM albums a
      LEFT JOIN album_tracks at ON at.album_id = a.id
      WHERE at.id IS NULL
      ORDER BY a.name ASC
      LIMIT ?
    `,
    )
    .all(limit);
}

/** 트랙이 0인 아티스트 (앨범에만 묶인 경우 포함). */
export function findOrphanArtists(limit = 500) {
  const db = getDB();
  return db
    .prepare(
      `
      SELECT ar.id, ar.name, ar.cover_type,
        (SELECT COUNT(*) FROM album_artists aa WHERE aa.artist_id = ar.id) AS album_count
      FROM artists ar
      WHERE NOT EXISTS (
        SELECT 1 FROM track_artists ta WHERE ta.artist_id = ar.id
      )
      ORDER BY album_count DESC, ar.name ASC
      LIMIT ?
    `,
    )
    .all(limit);
}

export function countEmptyAlbums() {
  const db = getDB();
  return db
    .prepare(
      `
      SELECT COUNT(*) as c
      FROM albums a
      LEFT JOIN album_tracks at ON at.album_id = a.id
      WHERE at.id IS NULL
    `,
    )
    .get().c;
}

export function countOrphanArtists() {
  const db = getDB();
  return db
    .prepare(
      `
      SELECT COUNT(*) as c
      FROM artists ar
      WHERE NOT EXISTS (
        SELECT 1 FROM track_artists ta WHERE ta.artist_id = ar.id
      )
    `,
    )
    .get().c;
}

/**
 * 트랙이 사라진 뒤 호출. 빈 앨범·고아 아티스트·이름 중복을 정리한다.
 * @returns {{ albumsRemoved: number, artistsRemoved: number, artistsMerged: number }}
 */
export function cleanupOrphans() {
  const db = getDB();

  const artistsMerged = mergeDuplicateArtistsByName();

  const emptyAlbums = findEmptyAlbums(10000);
  for (const row of emptyAlbums) {
    removeAlbumCoverFile(row.id, row.cover_type);
  }
  const albumIds = emptyAlbums.map((r) => r.id);

  const tx = db.transaction(() => {
    if (albumIds.length) {
      const placeholders = albumIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM albums WHERE id IN (${placeholders})`).run(...albumIds);
    }

    const orphanArtists = findOrphanArtists(10000);
    for (const row of orphanArtists) {
      removeArtistCoverFile(row.id, row.cover_type);
    }
    const artistIds = orphanArtists.map((r) => r.id);
    if (artistIds.length) {
      const placeholders = artistIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM artists WHERE id IN (${placeholders})`).run(...artistIds);
    }
    return { albumsRemoved: albumIds.length, artistsRemoved: artistIds.length };
  });

  const result = tx();
  try {
    pruneOrphanVisits();
  } catch (err) {
    console.error('❌ orphan visit 정리 중 오류:', err?.message || err);
  }
  return { ...result, artistsMerged };
}
