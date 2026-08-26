import { bulkUpdateTrackTags } from '../repositories/trackRepository.js';
import { clearTagCache } from '../services/tagService.js';

const MAX_TRACKS = 2000;
const MAX_TAG_LENGTH = 200;

/** 태그 이름 정리 — 앞뒤 공백을 털고 빈 값·지나치게 긴 값·중복을 걸러낸다. */
function normalizeTagNames(value) {
  if (!Array.isArray(value)) return [];
  const names = new Set();
  for (const raw of value) {
    const name = String(raw ?? '').trim();
    if (!name || name.length > MAX_TAG_LENGTH) continue;
    names.add(name);
  }
  return [...names];
}

export async function patchTracksTagsBulkHandler(request, reply) {
  const { trackIds, add, remove } = request.body ?? {};

  if (!Array.isArray(trackIds) || trackIds.length === 0) {
    return reply.code(400).send({ error: '대상 곡이 없습니다.' });
  }
  if (trackIds.length > MAX_TRACKS) {
    return reply.code(400).send({ error: `한 번에 ${MAX_TRACKS}곡까지 처리할 수 있습니다.` });
  }

  const addNames = normalizeTagNames(add);
  // 같은 태그가 양쪽에 들어오면 넣기를 이긴 것으로 본다
  const removeNames = normalizeTagNames(remove).filter((name) => !addNames.includes(name));
  if (addNames.length === 0 && removeNames.length === 0) {
    return reply.code(400).send({ error: '적용할 태그 변경이 없습니다.' });
  }

  try {
    const ids = [...new Set(trackIds.map((id) => String(id)))];
    const changed = bulkUpdateTrackTags(ids, { add: addNames, remove: removeNames });
    if (changed.length > 0) clearTagCache();
    return { success: true, updated: changed.length, tracks: changed };
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: '태그 일괄 적용 중 오류가 발생했습니다.' });
  }
}
