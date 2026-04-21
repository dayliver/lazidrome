import fs from 'fs';
import path from 'path';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'util';
import crypto from 'crypto';
import * as mm from 'music-metadata';
import { ulid } from 'ulid';
import { getDB } from '../db.js';

const pump = promisify(pipeline);

export default async function uploadRoutes(fastify) {
  const db = getDB();
  const TRACKS_PATH = process.env.TRACKS_PATH || './storage/tracks';

  // 업로드 전용 폴더 생성 (없을 경우)
  const UPLOAD_DIR = path.join(TRACKS_PATH);
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  fastify.post('/api/tracks/upload', async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.code(400).send({ error: '파일이 없습니다.' });

    const tempId = ulid();
    const ext = path.extname(data.filename);
    const fileName = `${tempId}${ext}`;
    const filePath = path.join(UPLOAD_DIR, fileName);

    try {
      // 1. 파일 저장
      await pump(data.file, fs.createWriteStream(filePath));

      // 2. 메타데이터 및 해시 추출
      const metadata = await mm.parseFile(filePath);
      const fileBuffer = fs.readFileSync(filePath);
      const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      // 3. DB 작업 (트랜잭션 권장)
      const insertFileData = db.prepare(`
        INSERT INTO track_filedata (id, path, size, duration, bitrate, format, source)
        VALUES (?, ?, ?, ?, ?, ?, 'upload')
      `);

      const insertMetadata = db.prepare(`
        INSERT INTO track_metadata (id, file_id, title, duration)
        VALUES (?, ?, ?, ?)
      `);

      // 기본적으로 파일명이나 메타데이터에서 제목 추출
      const title = metadata.common.title || data.filename.replace(ext, '');
      const duration = metadata.format.duration || 0;

      insertFileData.run(
        fileHash,
        filePath,
        fileBuffer.length,
        duration,
        Math.round(metadata.format.bitrate / 1000),
        metadata.format.container
      );

      const trackId = ulid();
      insertMetadata.run(trackId, fileHash, title, duration);

      return { 
        success: true, 
        trackId, 
        title,
        message: '음원이 성공적으로 업로드되었습니다.' 
      };

    } catch (err) {
      // 실패 시 저장된 파일 삭제
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      fastify.log.error(err);
      return reply.code(500).send({ error: '업로드 중 서버 오류가 발생했습니다.' });
    }
  });
}