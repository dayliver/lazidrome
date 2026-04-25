import { getCachedTags, fetchAndProcessTags } from '../services/tagService.js';

export async function getTagsHandler(request, reply) {
  try {
    // 1. 캐시 확인
    const cached = getCachedTags();
    if (cached) {
      return { success: true, cached: true, data: cached.data };
    }

    // 2. 캐시가 없으면 새로 생성
    const result = fetchAndProcessTags();
    return { success: true, cached: false, data: result.data };

  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: '태그 목록 통합 조회 중 서버 오류 발생' });
  }
}