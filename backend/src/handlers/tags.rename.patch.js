import { isClientSafeErrorMessage } from '../lib/httpErrors.js';
import { renameTagEverywhere } from '../repositories/tagRepository.js';
import { clearTagCache } from '../services/tagService.js';
import { renameTagCoverFile } from '../services/tagCoverService.js';
import { bumpLibraryRevisionNow } from '../lib/libraryRevision.js';

function assertTagLabel(name, label) {
  const s = String(name || '').trim();
  if (!s) throw new Error(`${label}이 비어 있습니다.`);
  if (s.includes('..') || /[/\\]/.test(s)) {
    throw new Error(`${label}에 /, \\, .. 는 사용할 수 없습니다.`);
  }
  if (s.length > 200) throw new Error(`${label}은 200자 이하여야 합니다.`);
  return s;
}

export async function patchTagRenameHandler(request, reply) {
  try {
    const { oldName, newName } = request.body || {};
    const oldTrim = assertTagLabel(oldName, '기존 태그 이름');
    const newTrim = assertTagLabel(newName, '새 태그 이름');

    if (oldTrim === newTrim) {
      return reply.code(400).send({ error: '기존 이름과 새 이름이 같습니다.' });
    }

    const stats = renameTagEverywhere(oldTrim, newTrim);

    try {
      renameTagCoverFile(oldTrim, newTrim);
    } catch (err) {
      request.log.warn({ err: err.message }, '태그 이미지 파일 이름 변경 생략');
    }

    clearTagCache();
    bumpLibraryRevisionNow();
    return { success: true, data: { ...stats, newName: newTrim } };
  } catch (err) {
    request.log.error(err);
    const msg = err instanceof Error ? err.message : '';
    if (isClientSafeErrorMessage(msg)) {
      return reply.code(400).send({ error: msg });
    }
    return reply.code(500).send({ error: '태그 이름 변경 중 오류가 발생했습니다.' });
  }
}
