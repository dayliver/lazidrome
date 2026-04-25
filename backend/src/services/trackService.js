import { getDB } from '../db.js';
import { 
  updateTrackMeta, 
  replaceTrackArtists, 
  findTrackById 
} from '../repositories/trackRepository.js';
import { 
  findAlbumByName, 
  createAlbum, 
  updateAlbumTrack, 
  findOrCreateArtist 
} from '../repositories/albumRepository.js';
import { saveCoverFromUrl, saveCoverFromBuffer } from './coverService.js';

const db = getDB();

export function editTrack(id, data, fileBuffer) {
  const { title, year, genre, tags, artists, albumId, albumName, newCoverUrl } = data;
  let targetAlbumId = albumId;

  // 트랜잭션: DB 쓰기만
  db.transaction(() => {
    updateTrackMeta(id, { title, genre, tags });

    if (!targetAlbumId && albumName) {
      const existing = findAlbumByName(albumName);
      targetAlbumId = existing ? existing.id : createAlbum(albumName, year);
    }

    if (targetAlbumId) updateAlbumTrack(id, targetAlbumId);

    if (Array.isArray(artists)) {
      const resolved = artists.map(a => ({
        artistId: findOrCreateArtist(a),
        role_mask: a.role_mask,
      }));
      replaceTrackArtists(id, resolved);
    }
  })();

  // 트랜잭션 밖: 파일 IO (비동기)
  // 반환해서 핸들러가 await 하게 함
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