// backend/src/routes/images.js
import path from 'path';
import fs from 'fs';
import { getDB } from '../db.js';

export default async function imageRoutes(fastify) {
  const db = getDB();
  const IMAGES_PATH = process.env.IMAGES_PATH || './storage/images';

  const fileExists = (fileName) => fs.existsSync(path.join(IMAGES_PATH, fileName));

  /**
   * [GET] /api/images/album/:id
   */
  fastify.get('/api/images/album/:id', async (req, reply) => {
    const { id } = req.params;
    const album = db.prepare('SELECT cover_type FROM albums WHERE id = ?').get(id);

    // 💉 cover_type(확장자)이 있다면 해당 파일을 찾아서 전송
    if (album?.cover_type) {
      const fileName = `${id}${album.cover_type}`;
      if (fileExists(fileName)) return reply.sendFile(fileName);
    }
    return reply.sendFile('default.png');
  });

  /**
   * [GET] /api/images/track/:id (폴백 로직 포함)
   */
  fastify.get('/api/images/track/:id', async (req, reply) => {
    const { id } = req.params;
    const track = db.prepare(`
      SELECT t.custom_cover_type, alb.id as album_id, alb.cover_type as album_cover_type
      FROM track_metadata t
      LEFT JOIN album_tracks at ON t.id = at.track_id AND at.is_primary = 1
      LEFT JOIN albums alb ON at.album_id = alb.id
      WHERE t.id = ?
    `).get(id);

    if (track?.custom_cover_type && fileExists(`track_${id}${track.custom_cover_type}`)) {
      return reply.sendFile(`track_${id}${track.custom_cover_type}`);
    }
    if (track?.album_id && track?.album_cover_type && fileExists(`${track.album_id}${track.album_cover_type}`)) {
      return reply.sendFile(`${track.album_id}${track.album_cover_type}`);
    }
    return reply.sendFile('default.png');
  });

  /**
   * [GET] /api/images/artist/:id
   */
  fastify.get('/api/images/artist/:id', async (req, reply) => {
    const { id } = req.params;
    const artist = db.prepare('SELECT cover_type FROM artists WHERE id = ?').get(id);
    if (artist?.cover_type && fileExists(`artist_${id}${artist.cover_type}`)) {
      return reply.sendFile(`artist_${id}${artist.cover_type}`);
    }
    return reply.sendFile('default.png');
  });
}