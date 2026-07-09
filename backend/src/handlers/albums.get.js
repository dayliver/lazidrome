import { countAlbums, findAllAlbums, findAlbumsPage } from '../repositories/albumRepository.js';
import { formatAlbumTags } from '../services/albumService.js';
import { parsePageQuery, parseSearchQuery } from '../lib/pageQuery.js';

function mapAlbumRow(a) {
  return formatAlbumTags({ ...a });
}

export async function getAlbumsHandler(request, reply) {
  try {
    const page = parsePageQuery(request.query ?? {});
    const q = parseSearchQuery(request.query ?? {});

    if (page) {
      const { offset, limit } = page;
      const total = countAlbums({ q });
      const rows = findAlbumsPage(offset, limit, { q });
      const items = rows.map(mapAlbumRow);
      return {
        items,
        total,
        offset,
        limit,
        hasMore: offset + items.length < total,
      };
    }

    const albums = findAllAlbums();
    return albums.map(mapAlbumRow);
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: '앨범 목록 조회 중 서버 오류 발생' });
  }
}
