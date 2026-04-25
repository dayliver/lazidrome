import { ulid } from 'ulid';
import { parsePlaylistRequest } from '../lib/playlistParser.js';
import { savePlaylistCoverImage } from '../services/playlistCoverService.js';
import { createPlaylistTransaction, updatePlaylistTransaction } from '../services/playlistService.js';
import { findPlaylistById, deletePlaylistById } from '../repositories/playlistRepository.js';

export async function createPlaylistHandler(request, reply) {
  try {
    const id = ulid();
    const { data, coverBuffer } = await parsePlaylistRequest(request);
    const coverType = await savePlaylistCoverImage(id, coverBuffer);
    
    createPlaylistTransaction(id, data, coverType);
    
    const newPlaylist = findPlaylistById(id);
    if (newPlaylist.rules) newPlaylist.rules = JSON.parse(newPlaylist.rules);
    return { success: true, data: newPlaylist };
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: '생성 실패' });
  }
}

export async function updatePlaylistHandler(request, reply) {
  try {
    const { id } = request.params;
    const playlist = findPlaylistById(id);
    if (!playlist) return reply.code(404).send({ error: 'Not found' });

    const { data, coverBuffer } = await parsePlaylistRequest(request);
    const newCoverType = await savePlaylistCoverImage(id, coverBuffer);
    const finalCoverType = newCoverType || playlist.cover_type;

    updatePlaylistTransaction(id, data, finalCoverType, playlist.type);

    const updatedPlaylist = findPlaylistById(id);
    if (updatedPlaylist.rules) updatedPlaylist.rules = JSON.parse(updatedPlaylist.rules);
    return { success: true, data: updatedPlaylist };
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: '수정 실패' });
  }
}

export async function deletePlaylistHandler(request, reply) {
  try {
    deletePlaylistById(request.params.id);
    return { success: true };
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: '삭제 실패' });
  }
}