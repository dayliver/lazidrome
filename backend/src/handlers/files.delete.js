import { TRACKS_PATH } from '../lib/importEnv.js';
import { deleteFileOrDirectory } from '../services/fileBrowserService.js';

/**
 * DELETE /api/files?path=Artist/Album/song.mp3
 */
export async function deleteFilesEntryHandler(request, reply) {
  const relativePath = request.query?.path ?? '';

  try {
    return deleteFileOrDirectory(TRACKS_PATH, relativePath);
  } catch (err) {
    const code = err.statusCode ?? 500;
    if (code >= 400 && code < 500) {
      return reply.code(code).send({ error: err.message || 'Invalid request' });
    }
    request.log.error(err, 'files delete failed');
    return reply.code(500).send({ error: 'Could not delete entry' });
  }
}
