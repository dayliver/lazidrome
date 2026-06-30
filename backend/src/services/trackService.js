import { getDB } from '../db.js';
import { 
  updateTrackMeta, 
  replaceTrackArtists, 
  findTrackById 
} from '../repositories/trackRepository.js';
import { 
  findAlbumByName, 
  createAlbum, 
  setPrimaryAlbumForTrack,
  findOrCreateAlbumByNameAndArtists,
  findOrCreateArtist 
} from '../repositories/albumRepository.js';
import { saveCoverFromUrl, saveCoverFromBuffer } from './coverService.js';
import { bumpLibraryRevisionNow } from '../lib/libraryRevision.js';

const db = getDB();

export function editTrack(id, data, fileBuffer) {
  const { title, year, genre, tags, artists, albumId, albumName, newCoverUrl } = data;
  let targetAlbumId = null;
  let resolvedArtistIds = null;

  db.transaction(() => {
    updateTrackMeta(id, { title, genre, tags });

    if (Array.isArray(artists)) {
      const resolved = artists.map((a) => ({
        artistId: findOrCreateArtist(a),
        role_mask: a.role_mask,
      }));
      replaceTrackArtists(id, resolved);
      resolvedArtistIds = resolved.map((a) => a.artistId);
    }

    const trimmedAlbum = albumName != null ? String(albumName).trim() : '';
    if (trimmedAlbum) {
      const artistIds =
        resolvedArtistIds ??
        db
          .prepare('SELECT artist_id FROM track_artists WHERE track_id = ?')
          .all(id)
          .map((r) => r.artist_id);

      if (artistIds.length > 0) {
        targetAlbumId = findOrCreateAlbumByNameAndArtists(trimmedAlbum, artistIds, year);
      } else {
        const existing = findAlbumByName(trimmedAlbum);
        targetAlbumId = existing ? existing.id : createAlbum(trimmedAlbum, year);
      }
    } else if (albumId) {
      targetAlbumId = albumId;
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