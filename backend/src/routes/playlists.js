import { getPlaylistsHandler, getPlaylistDetailHandler } from '../handlers/playlists.get.js';
import { createPlaylistHandler, updatePlaylistHandler, deletePlaylistHandler } from '../handlers/playlists.mutate.js';
import { addTracksToPlaylistHandler, reorderPlaylistTracksHandler, deletePlaylistTrackHandler } from '../handlers/playlists.tracks.js';

export default async function playlistRoutes(fastify) {
  // 플레이리스트 자체 CRUD
  fastify.get('/api/playlists', getPlaylistsHandler);
  fastify.get('/api/playlists/:id', getPlaylistDetailHandler);
  fastify.post('/api/playlists', createPlaylistHandler);
  fastify.put('/api/playlists/:id', updatePlaylistHandler);
  fastify.delete('/api/playlists/:id', deletePlaylistHandler);

  // 플레이리스트 내부 트랙 조작
  fastify.post('/api/playlists/:id/tracks', addTracksToPlaylistHandler);
  fastify.put('/api/playlists/:id/tracks/reorder', reorderPlaylistTracksHandler);
  fastify.delete('/api/playlists/:id/tracks/:playlistTrackId', deletePlaylistTrackHandler);
}