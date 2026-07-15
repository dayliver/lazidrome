import { replyHttpError } from '../lib/httpErrors.js';
import { editTrack, formatTrackDetail } from '../services/trackService.js';
import { saveCoverFromUrl, saveCoverFromBuffer } from '../services/coverService.js';
import { findTrackDetailById } from '../repositories/trackRepository.js';

export async function patchTrackHandler(request, reply) {
  const { id } = request.params;
  const isMultipart = request.headers['content-type']?.includes('multipart');

  let data = {};
  let fileBuffer = null;

  try {
    if (isMultipart) {
      const ALLOWED_FIELDS = new Set([
        'title',
        'year',
        'genre',
        'tags',
        'artists',
        'albumId',
        'albumName',
        'newCoverUrl',
        'volume_pct',
      ]);
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === 'file' && part.fieldname === 'newCoverFile') {
          fileBuffer = await part.toBuffer();
        } else if (ALLOWED_FIELDS.has(part.fieldname)) {   // ← 화이트리스트
          data[part.fieldname] = part.value;
        }
      }
      if (data.tags) data.tags = JSON.parse(data.tags);
      if (data.artists) data.artists = JSON.parse(data.artists);
      if (Object.prototype.hasOwnProperty.call(data, 'year')) {
        data.year =
          data.year === '' || data.year == null ? null : parseInt(data.year, 10);
      }
      if (Object.prototype.hasOwnProperty.call(data, 'volume_pct')) {
        data.volume_pct = parseInt(data.volume_pct, 10);
      }
    } else {
      data = request.body || {};
      if (Object.prototype.hasOwnProperty.call(data, 'year')) {
        data.year =
          data.year === '' || data.year == null ? null : parseInt(data.year, 10);
      }
      if (Object.prototype.hasOwnProperty.call(data, 'volume_pct')) {
        data.volume_pct = parseInt(data.volume_pct, 10);
      }
    }

    const { targetAlbumId, newCoverUrl } = editTrack(id, data, fileBuffer);

    if (targetAlbumId) {
      if (newCoverUrl) await saveCoverFromUrl(targetAlbumId, newCoverUrl);
      else if (fileBuffer) await saveCoverFromBuffer(targetAlbumId, fileBuffer);
    }

    const raw = findTrackDetailById(id);
    return { success: true, data: formatTrackDetail(raw) };
  } catch (err) {
    return replyHttpError(request, reply, err, { fallback: '트랙 수정 중 오류가 발생했습니다.' });
  }
}