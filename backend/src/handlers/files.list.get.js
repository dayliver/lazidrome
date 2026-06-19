import { TRACKS_PATH } from '../lib/importEnv.js';
import { listFilesDirectory } from '../services/fileBrowserService.js';

/**
 * GET /api/files?path=Artist/Album
 *
 * TRACKS_PATH 기준 디렉터리 목록 (읽기 전용).
 */
export async function getFilesListHandler(request, reply) {
  const relativePath = request.query?.path ?? '';

  try {
    return listFilesDirectory(TRACKS_PATH, relativePath);
  } catch (err) {
    const code = err.statusCode ?? 500;
    if (code >= 400 && code < 500) {
      return reply.code(code).send({ error: err.message || 'Invalid request' });
    }
    request.log.error(err, 'files list failed');
    return reply.code(500).send({ error: 'Could not list directory' });
  }
}
