import { commitStagedUpload } from '../services/uploadStagingService.js';

/** POST /api/upload/commit */
export async function postUploadCommitHandler(request, reply) {
  const items = request.body?.items;
  if (!Array.isArray(items) || items.length === 0) {
    return reply.code(400).send({ error: 'items 배열이 필요합니다.' });
  }

  const results = [];
  for (const item of items) {
    try {
      const data = await commitStagedUpload(item);
      results.push({ ...data, ok: true });
    } catch (err) {
      results.push({
        stagingId: item?.stagingId ?? null,
        ok: false,
        error: err.message || 'commit failed',
      });
    }
  }

  const failed = results.filter((r) => !r.ok).length;
  return {
    success: failed === 0,
    results,
    committed: results.filter((r) => r.ok).length,
    failed,
  };
}
