import fs from 'node:fs';
import db from '../db.js';

export default async function streamRoutes(fastify) {
  fastify.get('/api/stream/:id', async (request, reply) => {
    const { id } = request.params;

    // 1. DB에서 트랙 ID로 물리 파일의 경로와 정보 찾기
    const fileInfo = db.prepare(`
      SELECT f.path, f.size, f.format 
      FROM track_metadata t
      JOIN track_filedata f ON t.file_id = f.id
      WHERE t.id = ?
    `).get(id);

    // DB에 없거나 실제 파일이 삭제된 경우 404
    if (!fileInfo || !fs.existsSync(fileInfo.path)) {
      return reply.code(404).send({ error: 'Track or physical file not found' });
    }

    const { path: filePath, size: fileSize, format } = fileInfo;
    const range = request.headers.range;

    // 2. 확장자에 따른 정확한 MIME 타입 매핑
    const mimeTypes = {
      mp3: 'audio/mpeg',
      flac: 'audio/flac',
      wav: 'audio/wav',
      m4a: 'audio/mp4',
      ogg: 'audio/ogg'
    };
    const contentType = mimeTypes[format?.toLowerCase()] || 'application/octet-stream';

    // 3. 브라우저/플레이어가 '부분(Range)'을 요청한 경우 (탐색, 이어듣기)
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      
      const fileStream = fs.createReadStream(filePath, { start, end });
      
      // HTTP 206: Partial Content
      reply.code(206)
           .header('Content-Range', `bytes ${start}-${end}/${fileSize}`)
           .header('Accept-Ranges', 'bytes')
           .header('Content-Length', chunksize)
           .header('Content-Type', contentType);
           
      return reply.send(fileStream);
    } 
    // 4. 처음부터 끝까지 통째로 요청한 경우 (다운로드 등)
    else {
      const fileStream = fs.createReadStream(filePath);
      
      reply.code(200)
           .header('Content-Length', fileSize)
           .header('Content-Type', contentType)
           .header('Accept-Ranges', 'bytes'); // '나 부분 전송 지원해!' 라고 알려줌
           
      return reply.send(fileStream);
    }
  });
}