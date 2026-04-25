import { 
  getAlbumImageHandler, 
  getTrackImageHandler, 
  getArtistImageHandler, 
  getPlaylistImageHandler 
} from '../handlers/images.get.js';

export default async function imageRoutes(fastify) {
  fastify.get('/api/images/album/:id', getAlbumImageHandler);
  fastify.get('/api/images/track/:id', getTrackImageHandler);
  fastify.get('/api/images/artist/:id', getArtistImageHandler);
  fastify.get('/api/images/playlist/:id', getPlaylistImageHandler);
}