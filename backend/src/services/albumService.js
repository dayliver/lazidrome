import { getDB } from '../db.js';
import { 
  updateAlbumMeta, 
  replaceAlbumArtists, 
  replaceAlbumTracks, 
  findOrCreateArtist 
} from '../repositories/albumRepository.js';
import { bumpLibraryRevisionNow } from '../lib/libraryRevision.js';

const db = getDB();

export function editAlbum(id, data) {
  const { title, year, mbid, tags, description, albumArtists, albumTracks } = data;

  // DB 수정은 모두 하나의 트랜잭션 안에서 안전하게 처리합니다.
  db.transaction(() => {
    updateAlbumMeta(id, { title, year, mbid, tags, description });

    if ('albumArtists' in data && Array.isArray(albumArtists)) {
      const resolvedArtists = albumArtists.map(a => ({
        artistId: findOrCreateArtist(a)
      }));
      replaceAlbumArtists(id, resolvedArtists);
    }

    if ('albumTracks' in data && Array.isArray(albumTracks) && albumTracks.length > 0) {
      replaceAlbumTracks(id, albumTracks);
    }
  })();

  bumpLibraryRevisionNow();
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