import {
  findEmptyAlbums,
  findOrphanArtists,
  countEmptyAlbums,
  countOrphanArtists,
} from '../lib/orphanCleanup.js';

/**
 * GET /api/admin/db/orphans
 *
 * 트랙이 0인 앨범, 트랙이 없는 아티스트(앨범에만 묶인 경우 포함)를 한 페이지에 묶어 반환.
 * 현재는 한 사용자(관리자) 전용이므로 단순한 평면 응답으로 두었다.
 */
export async function getAdminDbOrphansHandler(_request, _reply) {
  const emptyAlbums = findEmptyAlbums(500);
  const orphanArtists = findOrphanArtists(500);

  return {
    emptyAlbums: {
      total: countEmptyAlbums(),
      items: emptyAlbums.map((row) => ({
        id: row.id,
        name: row.name,
        year: row.year ?? null,
        coverType: row.cover_type ?? null,
      })),
    },
    orphanArtists: {
      total: countOrphanArtists(),
      items: orphanArtists.map((row) => ({
        id: row.id,
        name: row.name,
        coverType: row.cover_type ?? null,
        albumCount: Number(row.album_count) || 0,
      })),
    },
  };
}
