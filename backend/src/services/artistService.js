import { getDB } from '../db.js';
import { updateArtistMeta, upsertArtistBio, deleteArtistBio } from '../repositories/artistRepository.js';

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

  db.transaction(() => {
    // 프론트에서 artist.name을 title이라는 키로 보내고 있습니다.
    updateArtistMeta(id, { name: title, tags, mbid });

    if (biography !== undefined) {
      if (biography && biography.trim() !== '') {
        upsertArtistBio(id, 'en', biography.trim());
      } else {
        deleteArtistBio(id, 'en');
      }
    }
  })();
}

// 💡 [버그 방지] DB의 태그 문자열을 안전하게 배열로 변환
export function formatArtistTags(raw) {
  if (!raw) return null;
  try {
    raw.tags = raw.tags ? JSON.parse(raw.tags) : [];
  } catch {
    raw.tags = [];
  }
  return raw;
}