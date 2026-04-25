import { 
  resolveAlbumImage, 
  resolveTrackImage, 
  resolveArtistImage, 
  resolvePlaylistImage, 
  getDefaultImage 
} from '../services/imageService.js';

// 💡 공통 헬퍼: 경로가 있으면 쏴주고, 없으면 디폴트, 디폴트도 없으면 404
function sendImageResponse(reply, imagePath) {
  if (imagePath) {
    return reply.sendFile(imagePath);
  }
  const defaultPath = getDefaultImage();
  if (defaultPath) {
    return reply.sendFile(defaultPath);
  }
  return reply.code(404).send({ error: 'Image not found' });
}

export async function getAlbumImageHandler(request, reply) {
  const { id } = request.params;
  const imagePath = resolveAlbumImage(id);
  return sendImageResponse(reply, imagePath);
}

export async function getTrackImageHandler(request, reply) {
  const { id } = request.params;
  const imagePath = resolveTrackImage(id);
  return sendImageResponse(reply, imagePath);
}

export async function getArtistImageHandler(request, reply) {
  const { id } = request.params;
  const imagePath = resolveArtistImage(id);
  return sendImageResponse(reply, imagePath);
}

export async function getPlaylistImageHandler(request, reply) {
  const { id } = request.params;
  const imagePath = resolvePlaylistImage(id);
  return sendImageResponse(reply, imagePath);
}