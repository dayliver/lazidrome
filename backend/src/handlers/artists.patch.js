import { replyHttpError } from '../lib/httpErrors.js';
import { editArtist, formatArtistTags } from '../services/artistService.js';
import { saveArtistCoverFromUrl, saveArtistCoverFromBuffer } from '../services/artistCoverService.js';
import { findBasicArtistById, findArtistBio } from '../repositories/artistRepository.js';

export async function patchArtistHandler(request, reply) {
  const { id } = request.params;
  const isMultipart = request.headers['content-type']?.includes('multipart');
  
  let data = {};
  let fileBuffer = null;

  try {
    if (isMultipart) {
      const ALLOWED_FIELDS = new Set(['title', 'biography', 'tags', 'mbid', 'newCoverUrl']);
      const parts = request.parts();
      
      for await (const part of parts) {
        if (part.type === 'file' && part.fieldname === 'newCoverFile') {
          fileBuffer = await part.toBuffer();
        } else if (ALLOWED_FIELDS.has(part.fieldname)) {
          data[part.fieldname] = part.value;
        }
      }
      if (data.tags) {
        try {
          data.tags = JSON.parse(data.tags);
        } catch {
          const err = new Error('tags 필드가 유효한 JSON이 아닙니다.');
          err.statusCode = 400;
          throw err;
        }
      }
    } else {
      data = request.body;
    }

    // 1. DB 업데이트 트랜잭션
    editArtist(id, data);

    // 2. 이미지 처리
    if (data.newCoverUrl) {
      await saveArtistCoverFromUrl(id, data.newCoverUrl);
    } else if (fileBuffer) {
      await saveArtistCoverFromBuffer(id, fileBuffer);
    }

    // 3. 최신 데이터 파싱 및 반환
    const raw = findBasicArtistById(id);
    const artist = formatArtistTags(raw);
    const bioRow = findArtistBio(id, 'en');
    if (artist) {
      artist.bio = bioRow?.biography ?? '';
    }
    return { success: true, data: artist };
  } catch (err) {
    return replyHttpError(request, reply, err, { fallback: '아티스트 수정 중 오류가 발생했습니다.' });
  }
}