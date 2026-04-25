import { addTracksTransaction, reorderTracksTransaction } from '../services/playlistService.js';
import { findPlaylistById, deletePlaylistTrack } from '../repositories/playlistRepository.js';

export async function addTracksToPlaylistHandler(request, reply) {
  try {
    const { id } = request.params;
    const { trackIds } = request.body;
    if (!Array.isArray(trackIds) || trackIds.length === 0) return reply.code(400).send({ error: '추가할 곡이 없습니다.' });

    const playlist = findPlaylistById(id);
    if (playlist?.type !== 'list') return reply.code(400).send({ error: '수동 플레이리스트에만 가능합니다.' });

    addTracksTransaction(id, trackIds);
    return { success: true };
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: '곡 추가 실패' });
  }
}

export async function reorderPlaylistTracksHandler(request, reply) {
  try {
    reorderTracksTransaction(request.params.id, request.body.items);
    return { success: true };
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: '순서 변경 실패' });
  }
}

export async function deletePlaylistTrackHandler(request, reply) {
  try {
    deletePlaylistTrack(request.params.playlistTrackId, request.params.id);
    return { success: true };
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: '곡 삭제 실패' });
  }
}