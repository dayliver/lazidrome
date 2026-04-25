import fs from 'node:fs';
import { getTrackPhysicalFile, getContentType, parseRange } from '../services/streamService.js';

export async function streamTrackHandler(request, reply) {
  const { id } = request.params;
  const rangeHeader = request.headers.range;

  try {
    // 1. 파일 정보 획득 (Service 위임)
    const fileInfo = getTrackPhysicalFile(id);
    if (!fileInfo) {
      return reply.code(404).send({ error: 'Track or physical file not found' });
    }

    const { path: filePath, size: fileSize, format } = fileInfo;
    
    // 2. 헤더 정보 계산 (Service 위임)
    const contentType = getContentType(format);
    const rangeInfo = parseRange(rangeHeader, fileSize);

    // 3. 브라우저/플레이어가 '부분(Range)'을 요청한 경우 (탐색, 이어듣기)
    if (rangeInfo) {
      const { start, end, chunksize } = rangeInfo;
      const fileStream = fs.createReadStream(filePath, { start, end });
      
      reply.code(206)
           .header('Content-Range', `bytes ${start}-${end}/${fileSize}`)
           .header('Accept-Ranges', 'bytes')
           .header('Content-Length', chunksize)
           .header('Content-Type', contentType);
           
      return reply.send(fileStream);
    } 
    // 4. 처음부터 끝까지 통째로 요청한 경우
    else {
      const fileStream = fs.createReadStream(filePath);
      
      reply.code(200)
           .header('Content-Length', fileSize)
           .header('Content-Type', contentType)
           .header('Accept-Ranges', 'bytes');
           
      return reply.send(fileStream);
    }
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: '오디오 스트리밍 중 서버 오류 발생' });
  }
}