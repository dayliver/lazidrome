import { getDB } from '../db.js';
import {
  updateAlbumMeta,
  replaceAlbumArtists,
  replaceAlbumTracks,
  findOrCreateArtist,
  findBasicAlbumById,
  countAlbumTracks,
  deleteAlbumById,
} from '../repositories/albumRepository.js';
import { bumpLibraryRevisionNow } from '../lib/libraryRevision.js';
import { pruneOrphanVisits } from '../repositories/pageVisitsRepository.js';
import fs from 'node:fs';
import path from 'node:path';

const db = getDB();

function removeAlbumCoverFile(albumId, coverType) {
  if (!albumId || !coverType) return;
  const file = path.join(
    process.env.IMAGES_PATH || './storage/images',
    'albums',
    `${albumId}${coverType}`,
  );
  try {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch (err) {
    console.error(`❌ 앨범 커버 삭제 실패 ${file}:`, err.message);
  }
}

export function editAlbum(id, data) {
  const { title, year, mbid, tags, description, albumArtists, albumTracks } = data;

  db.transaction(() => {
    updateAlbumMeta(id, { title, year, mbid, tags, description });

    if ('albumArtists' in data && Array.isArray(albumArtists)) {
      const resolvedArtists = albumArtists.map((a) => ({
        artistId: findOrCreateArtist(a),
      }));
      replaceAlbumArtists(id, resolvedArtists);
    }

    if ('albumTracks' in data && Array.isArray(albumTracks) && albumTracks.length > 0) {
      replaceAlbumTracks(id, albumTracks);
    }
  })();

  bumpLibraryRevisionNow();
}

/** 수록곡이 없는 앨범만 삭제. 곡이 있으면 409. */
export function deleteAlbum(id) {
  const album = findBasicAlbumById(id);
  if (!album) {
    const err = new Error('Not found: album');
    err.statusCode = 404;
    throw err;
  }
  const trackCount = countAlbumTracks(id);
  if (trackCount > 0) {
    const err = new Error('HAS_TRACKS');
    err.statusCode = 409;
    err.trackCount = trackCount;
    throw err;
  }
  removeAlbumCoverFile(id, album.cover_type);
  deleteAlbumById(id);
  try {
    pruneOrphanVisits();
  } catch (err) {
    console.error('❌ orphan visit 정리 중 오류:', err?.message || err);
  }
  bumpLibraryRevisionNow();
  return { id, deleted: true };
}

export function formatAlbumTags(raw) {
  if (!raw) return null;
  try {
    raw.tags = raw.tags ? JSON.parse(raw.tags) : [];
  } catch {
    raw.tags = [];
  }
  return raw;
}
