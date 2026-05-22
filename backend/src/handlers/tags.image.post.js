import { isClientSafeErrorMessage } from '../lib/httpErrors.js';
import { saveTagCoverFromBuffer, saveTagCoverFromUrl } from '../services/tagCoverService.js';
import { clearTagCache } from '../services/tagService.js';

export async function postTagImageHandler(request, reply) {
  let tagName = '';
  let fileBuffer = null;
  let imageUrl = '';

  try {
    const parts = request.parts();
    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'image') {
        fileBuffer = await part.toBuffer();
      } else if (part.fieldname === 'tagName') {
        tagName = String(part.value || '').trim();
      } else if (part.fieldname === 'imageUrl') {
        imageUrl = String(part.value || '').trim();
      }
    }

    if (!tagName) {
      return reply.code(400).send({ error: 'tagName 필드가 필요합니다.' });
    }
    if (fileBuffer?.length) {
      await saveTagCoverFromBuffer(tagName, fileBuffer);
    } else if (imageUrl) {
      await saveTagCoverFromUrl(tagName, imageUrl);
    } else {
      return reply.code(400).send({ error: '이미지 파일(image) 또는 imageUrl이 필요합니다.' });
    }

    clearTagCache();
    return { success: true };
  } catch (err) {
    request.log.error(err);
    const msg = err instanceof Error ? err.message : '';
    if (isClientSafeErrorMessage(msg)) {
      return reply.code(400).send({ error: msg });
    }
    return reply.code(500).send({ error: '태그 이미지 저장 중 오류가 발생했습니다.' });
  }
}
