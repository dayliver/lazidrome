/**
 * 동일 이름(대소문자 무시) 아티스트 중복 병합.
 * db.js 부팅 마이그레이션과 orphanCleanup 공용 — getDB만 의존해 순환 import를 피한다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { getDB } from '../db.js';

const IMAGES_PATH = process.env.IMAGES_PATH || './storage/images';

function removeIfExists(filePath) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    console.error(`❌ 파일 삭제 실패 ${filePath}:`, err.message);
  }
}

function parseJsonTags(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * @returns {number} 제거된 중복 아티스트 수
 */
export function mergeDuplicateArtistsByName() {
  const db = getDB();
  const groups = db
    .prepare(
      `
      SELECT lower(name) AS name_key, COUNT(*) AS c
      FROM artists
      GROUP BY lower(name)
      HAVING c > 1
    `,
    )
    .all();
  if (!groups.length) return 0;

  const scoreRow = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM track_artists ta WHERE ta.artist_id = ar.id) AS track_links,
      (SELECT COUNT(*) FROM album_artists aa WHERE aa.artist_id = ar.id) AS album_links,
      ar.id, ar.name, ar.tags, ar.cover_type, ar.mbid
    FROM artists ar
    WHERE lower(ar.name) = ?
  `);

  const moveTrackArtists = db.prepare(`
    INSERT OR IGNORE INTO track_artists (track_id, artist_id, role_mask)
    SELECT track_id, ?, role_mask FROM track_artists WHERE artist_id = ?
  `);
  const moveAlbumArtists = db.prepare(`
    INSERT OR IGNORE INTO album_artists (album_id, artist_id)
    SELECT album_id, ? FROM album_artists WHERE artist_id = ?
  `);
  const moveBios = db.prepare(`
    INSERT INTO artist_biographies (artist_id, language, biography)
    SELECT ?, language, biography FROM artist_biographies WHERE artist_id = ?
    ON CONFLICT(artist_id, language) DO UPDATE SET
      biography = CASE
        WHEN length(COALESCE(artist_biographies.biography, '')) > 0 THEN artist_biographies.biography
        ELSE excluded.biography
      END
  `);
  const moveVisits = db.prepare(`
    UPDATE page_visits SET entity_id = ?
    WHERE entity_type = 'artist' AND entity_id = ?
  `);
  const deleteArtist = db.prepare('DELETE FROM artists WHERE id = ?');
  const updateKeeperMeta = db.prepare(
    'UPDATE artists SET tags = ?, cover_type = ?, mbid = ? WHERE id = ?',
  );

  let removed = 0;

  const tx = db.transaction(() => {
    for (const g of groups) {
      const rows = scoreRow.all(g.name_key);
      if (rows.length < 2) continue;
      rows.sort((a, b) => {
        const sa = (Number(a.track_links) || 0) * 1000 + (Number(a.album_links) || 0);
        const sb = (Number(b.track_links) || 0) * 1000 + (Number(b.album_links) || 0);
        if (sb !== sa) return sb - sa;
        return String(a.id).localeCompare(String(b.id));
      });
      const keeper = rows[0];
      let tags = parseJsonTags(keeper.tags);
      let coverType = keeper.cover_type || null;
      let mbid = keeper.mbid || null;

      for (const loser of rows.slice(1)) {
        moveTrackArtists.run(keeper.id, loser.id);
        moveAlbumArtists.run(keeper.id, loser.id);
        try {
          moveBios.run(keeper.id, loser.id);
        } catch {
          /* biographies 테이블 없을 수 있음 */
        }
        try {
          moveVisits.run(keeper.id, loser.id);
        } catch {
          /* page_visits 없을 수 있음 */
        }

        const loserTags = parseJsonTags(loser.tags);
        for (const t of loserTags) {
          if (!tags.some((x) => x.toLowerCase() === t.toLowerCase())) tags.push(t);
        }
        if (!coverType && loser.cover_type) {
          const src = path.join(IMAGES_PATH, 'artists', `${loser.id}${loser.cover_type}`);
          const dest = path.join(IMAGES_PATH, 'artists', `${keeper.id}${loser.cover_type}`);
          try {
            if (fs.existsSync(src) && !fs.existsSync(dest)) {
              fs.renameSync(src, dest);
              coverType = loser.cover_type;
            }
          } catch (err) {
            console.error(`❌ 아티스트 커버 병합 실패 ${loser.id}→${keeper.id}:`, err.message);
          }
        }
        if (!mbid && loser.mbid) mbid = loser.mbid;

        if (loser.cover_type) {
          removeIfExists(path.join(IMAGES_PATH, 'artists', `${loser.id}${loser.cover_type}`));
        }
        deleteArtist.run(loser.id);
        removed += 1;
      }

      updateKeeperMeta.run(
        tags.length ? JSON.stringify(tags) : keeper.tags,
        coverType,
        mbid,
        keeper.id,
      );
    }
    return removed;
  });

  return tx();
}
