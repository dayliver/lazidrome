import { replyHttpError } from '../lib/httpErrors.js';
import { editAlbum, formatAlbumTags } from '../services/albumService.js';
import { saveCoverFromUrl, saveCoverFromBuffer } from '../services/coverService.js';
import { findBasicAlbumById } from '../repositories/albumRepository.js';

export async function patchAlbumHandler(request, reply) {
  const { id } = request.params;
  const isMultipart = request.headers['content-type']?.includes('multipart');

  let data = {};
  let fileBuffer = null;

  try {
    if (isMultipart) {
      // 💡 철통 보안 화이트리스트
      const ALLOWED_FIELDS = new Set(['title', 'year', 'mbid', 'tags', 'description', 'albumArtists', 'albumTracks', 'newCoverUrl']);
      const parts = request.parts();
      
      for await (const part of parts) {
        if (part.type === 'file' && part.fieldname === 'newCoverFile') {
          fileBuffer = await part.toBuffer();
        } else if (ALLOWED_FIELDS.has(part.fieldname)) {
          data[part.fieldname] = part.value;
        }
      }
      
      if (data.tags) data.tags = JSON.parse(data.tags);
      if (data.year) data.year = parseInt(data.year, 10);
      if (data.albumArtists) data.albumArtists = JSON.parse(data.albumArtists);
      if (data.albumTracks) data.albumTracks = JSON.parse(data.albumTracks);
    } else {
      data = request.body;
    }

    // 1. DB 트랜잭션 실행
    editAlbum(id, data);

    // 2. 파일 시스템 작업 (coverService 재사용!)
    if (data.newCoverUrl) {
      await saveCoverFromUrl(id, data.newCoverUrl);
    } else if (fileBuffer) {
      await saveCoverFromBuffer(id, fileBuffer);
    }

    // 3. 최신 데이터 반환
    const raw = findBasicAlbumById(id);
    return { success: true, data: formatAlbumTags(raw) };

  } catch (err) {
    return replyHttpError(request, reply, err, { fallback: '앨범 수정 중 오류가 발생했습니다.' });
  }
}