import { getDB } from '../db.js';
import {
  updateArtistMeta,
  upsertArtistBio,
  deleteArtistBio,
  findBasicArtistById,
  countArtistTracks,
  deleteArtistById,
} from '../repositories/artistRepository.js';
import { bumpLibraryRevisionNow } from '../lib/libraryRevision.js';
import { pruneOrphanVisits } from '../repositories/pageVisitsRepository.js';
import fs from 'node:fs';
import path from 'node:path';

function removeArtistCoverFile(artistId, coverType) {
  if (!artistId || !coverType) return;
  const file = path.join(
    process.env.IMAGES_PATH || './storage/images',
    'artists',
    `${artistId}${coverType}`,
  );
  try {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch (err) {
    console.error(`❌ 아티스트 커버 삭제 실패 ${file}:`, err.message);
  }
}

export function mergeTags(localTags, externalTags, mode) {
  if (mode === 'force') return externalTags;
  if (mode === 'fill' && (!localTags || localTags.length === 0)) return externalTags;

  const localArr = localTags ? JSON.parse(localTags) : [];
  const merged = [...new Set([...localArr, ...externalTags])];
  return merged.length > 0 ? merged : null;
}

export function editArtist(id, data) {
  const db = getDB();
  const { title, biography, tags, mbid } = data;

  const meta = {};
  if (title !== undefined) meta.name = title;
  if (tags !== undefined) meta.tags = tags;
  if (mbid !== undefined) meta.mbid = mbid;

  db.transaction(() => {
    if (Object.keys(meta).length) {
      updateArtistMeta(id, meta);
    }

    if (biography !== undefined) {
      if (biography && biography.trim() !== '') {
        upsertArtistBio(id, 'en', biography.trim());
      } else {
        deleteArtistBio(id, 'en');
      }
    }
  })();

  bumpLibraryRevisionNow();
}

/**
 * 아티스트 삭제. 곡/앨범 크레딧(track_artists·album_artists)은 함께 제거되며
 * 트랙·앨범 자체는 남는다. FK CASCADE와 명시적 unlink를 함께 쓴다.
 */
export function deleteArtist(id) {
  const artist = findBasicArtistById(id);
  if (!artist) {
    const err = new Error('Not found: artist');
    err.statusCode = 404;
    throw err;
  }
  const db = getDB();
  const trackCount = countArtistTracks(id);
  const albumLinkCount =
    Number(
      db.prepare('SELECT COUNT(*) AS c FROM album_artists WHERE artist_id = ?').get(id)?.c,
    ) || 0;

  db.transaction(() => {
    db.prepare('DELETE FROM track_artists WHERE artist_id = ?').run(id);
    db.prepare('DELETE FROM album_artists WHERE artist_id = ?').run(id);
    deleteArtistById(id);
  })();

  removeArtistCoverFile(id, artist.cover_type);
  try {
    pruneOrphanVisits();
  } catch (err) {
    console.error('❌ orphan visit 정리 중 오류:', err?.message || err);
  }
  bumpLibraryRevisionNow();
  return {
    id,
    deleted: true,
    unlinkedTracks: trackCount,
    unlinkedAlbums: albumLinkCount,
  };
}

export function formatArtistTags(raw) {
  if (!raw) return null;
  try {
    raw.tags = raw.tags ? JSON.parse(raw.tags) : [];
  } catch {
    raw.tags = [];
  }
  return raw;
}
