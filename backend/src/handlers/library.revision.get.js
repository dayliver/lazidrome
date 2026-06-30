import { getLibraryRevision } from '../lib/libraryRevision.js';

/** GET /api/library/revision — artists/albums 전체 fetch 전 변경 여부 확인용 */
export async function getLibraryRevisionHandler(_request, _reply) {
  return getLibraryRevision();
}
