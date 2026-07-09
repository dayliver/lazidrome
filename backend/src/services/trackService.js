import { getDB } from '../db.js';
import { 
  updateTrackMeta, 
  replaceTrackArtists, 
  findTrackById 
} from '../repositories/trackRepository.js';
import {
  findAlbumById,
  createAlbum,
  setPrimaryAlbumForTrack,
  findOrCreateArtist,
} from '../repositories/albumRepository.js';
import { saveCoverFromUrl, saveCoverFromBuffer } from './coverService.js';
import { bumpLibraryRevisionNow } from '../lib/libraryRevision.js';

const db = getDB();

export function editTrack(id, data, fileBuffer) {
  const { title, year, genre, tags, artists, albumId, albumName, newCoverUrl } = data;
  let targetAlbumId = null;

  db.transaction(() => {
    updateTrackMeta(id, { title, genre, tags });

    if (Array.isArray(artists)) {
      const resolved = artists.map((a) => ({
        artistId: findOrCreateArtist(a),
        role_mask: a.role_mask,
      }));
      replaceTrackArtists(id, resolved);
    }

    const trimmedAlbumId = albumId != null ? String(albumId).trim() : '';
    const trimmedAlbum = albumName != null ? String(albumName).trim() : '';

    if (trimmedAlbumId) {
      if (!findAlbumById(trimmedAlbumId)) {
        const err = new Error('Not found: album');
        err.statusCode = 404;
        throw err;
      }
      targetAlbumId = trimmedAlbumId;
    } else if (trimmedAlbum) {
      targetAlbumId = createAlbum(trimmedAlbum, year);
    }

    if (targetAlbumId) setPrimaryAlbumForTrack(id, targetAlbumId);
  })();

  bumpLibraryRevisionNow();
  return { targetAlbumId, newCoverUrl, fileBuffer };
}

export function formatTrack(raw) {
  if (!raw) return null;
  try {
    raw.tags = raw.tags ? JSON.parse(raw.tags) : [];
  } catch {
    raw.tags = [];
  }
  raw.artist = JSON.parse(raw.artists_json || '[]').map(a => a.name).join(', ');
  delete raw.artists_json;
  return raw;
}

function parseJsonArray(raw, fallback = []) {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function formatTrackDetail(raw) {
  if (!raw) return null;
  const result = { ...raw };
  result.tags = parseJsonArray(raw.tags, []);
  result.artists = parseJsonArray(raw.artists_json);
  result.albums = parseJsonArray(raw.albums_json);
  result.playlists = parseJsonArray(raw.playlists_json);
  delete result.artists_json;
  delete result.albums_json;
  delete result.playlists_json;
  result.artist = result.artists.map((a) => a.name).join(', ');
  return result;
}