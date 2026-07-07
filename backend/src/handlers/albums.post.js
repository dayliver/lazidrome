import { findOrCreateAlbumByNameAndArtists } from '../repositories/albumRepository.js';

export async function postAlbumHandler(request, reply) {
  const body = request.body && typeof request.body === 'object' ? request.body : {};
  const name = String(body.name ?? '').trim();
  const yearRaw = body.year;
  const year =
    yearRaw === undefined || yearRaw === null || yearRaw === ''
      ? null
      : Number(yearRaw);
  const artistIds = Array.isArray(body.artist_ids)
    ? body.artist_ids.map((id) => String(id)).filter(Boolean)
    : Array.isArray(body.artistIds)
      ? body.artistIds.map((id) => String(id)).filter(Boolean)
      : [];

  if (!name) {
    return reply.code(400).send({ success: false, error: '앨범 이름이 필요합니다.' });
  }
  if (year != null && (!Number.isFinite(year) || year < 0 || year > 9999)) {
    return reply.code(400).send({ success: false, error: '연도가 올바르지 않습니다.' });
  }

  try {
    const id = findOrCreateAlbumByNameAndArtists(name, artistIds, year);
    return { success: true, data: { id } };
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ success: false, error: '앨범 생성 중 오류가 발생했습니다.' });
  }
}
