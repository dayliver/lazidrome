import { hasMediaOrJwtAccess } from '../lib/mediaAuth.js';
import { 
  getAlbumImageHandler, 
  getTrackImageHandler, 
  getArtistImageHandler, 
  getPlaylistImageHandler,
  getTagImageHandler
} from '../handlers/images.get.js';

export default async function imageRoutes(fastify) {
  fastify.addHook('preHandler', async (request, reply) => {
    const secret = fastify.mediaSigningSecret;
    if (!secret || !hasMediaOrJwtAccess(request, secret)) {
      return reply.code(401).send({ error: '이미지 접근 권한이 없습니다.' });
    }
  });

  fastify.get('/api/images/album/:id', getAlbumImageHandler);
  fastify.get('/api/images/track/:id', getTrackImageHandler);
  fastify.get('/api/images/artist/:id', getArtistImageHandler);
  fastify.get('/api/images/playlist/:id', getPlaylistImageHandler);
  fastify.get('/api/images/tag', getTagImageHandler);
}