import { cleanupOrphans } from '../lib/orphanCleanup.js';

/**
 * POST /api/admin/db/cleanup
 * 트랙이 0인 앨범과 어디에도 안 묶인 고아 아티스트를 일괄 삭제한다.
 */
export async function postAdminDbCleanupHandler(_request, reply) {
  try {
    const result = cleanupOrphans();
    return {
      success: true,
      ...result,
    };
  } catch (err) {
    reply.log.error(err);
    return reply.code(500).send({ error: '라이브러리 정리 중 오류가 발생했습니다.' });
  }
}
