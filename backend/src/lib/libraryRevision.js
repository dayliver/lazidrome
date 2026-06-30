import { ulid } from 'ulid';
import db from '../db.js';
import { countTracks } from '../repositories/trackRepository.js';

const LIBRARY_REVISION_KEY = 'library_revision';
const BUMP_DEBOUNCE_MS = 750;

let bumpTimer = null;

function countAlbums() {
  return db.prepare('SELECT COUNT(*) AS n FROM albums').get().n;
}

function countArtists() {
  return db.prepare('SELECT COUNT(*) AS n FROM artists').get().n;
}

function writeRevision(revision) {
  db.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `).run(LIBRARY_REVISION_KEY, revision);
  return revision;
}

/** 스캐너 등 연속 변경은 짧게 묶어서 한 번만 갱신 */
export function bumpLibraryRevision() {
  if (bumpTimer) clearTimeout(bumpTimer);
  bumpTimer = setTimeout(() => {
    bumpTimer = null;
    writeRevision(ulid());
  }, BUMP_DEBOUNCE_MS);
}

/** 업로드·메타 편집·DB 정리 등 즉시 반영이 필요할 때 */
export function bumpLibraryRevisionNow() {
  if (bumpTimer) {
    clearTimeout(bumpTimer);
    bumpTimer = null;
  }
  return writeRevision(ulid());
}

export function getLibraryRevision() {
  let row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(LIBRARY_REVISION_KEY);
  if (!row?.value) {
    writeRevision(ulid());
    row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(LIBRARY_REVISION_KEY);
  }
  return {
    revision: row.value,
    trackCount: countTracks(),
    albumCount: countAlbums(),
    artistCount: countArtists(),
  };
}
