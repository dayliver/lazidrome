import fs from 'node:fs';
import {
  getTrackPhysicalFile,
  getContentType,
  parseRange,
  getPreviewMaxByteIndex,
  clampByteRangeForPreview,
  DEFAULT_STREAM_PREVIEW_SECONDS,
} from '../services/streamService.js';
import { hasMediaOrJwtAccess } from '../lib/mediaAuth.js';

function isStreamFullAccess(request) {
  const secret = request.server?.mediaSigningSecret;
  if (secret && hasMediaOrJwtAccess(request, secret)) return true;
  return false;
}

export async function streamTrackHandler(request, reply) {
  const { id } = request.params;
  const rangeHeader = request.headers.range;

  const previewSec = Number(process.env.STREAM_PREVIEW_SECONDS);
  const previewSeconds = Number.isFinite(previewSec) && previewSec > 0 ? previewSec : DEFAULT_STREAM_PREVIEW_SECONDS;

  try {
    const fileInfo = getTrackPhysicalFile(id);
    if (!fileInfo) {
      return reply.code(404).send({ error: 'Track or physical file not found' });
    }

    const { path: filePath, size: fileSize, format } = fileInfo;
    const durationSec = fileInfo.duration_sec;

    const fullAccess = isStreamFullAccess(request);
    const previewMaxEnd = getPreviewMaxByteIndex(fileSize, durationSec, previewSeconds);
    const effectiveTotalBytes = fullAccess ? fileSize : previewMaxEnd + 1;

    const contentType = getContentType(format);

    if (rangeHeader) {
      const rangeInfo = parseRange(rangeHeader, fileSize);

      if (!fullAccess) {
        const clamped = clampByteRangeForPreview(rangeInfo.start, rangeInfo.end, previewMaxEnd, fileSize);
        if (clamped === null) {
          return reply
            .code(416)
            .header('Content-Range', `bytes */${effectiveTotalBytes}`)
            .send();
        }
        const { start, end } = clamped;
        const fileStream = fs.createReadStream(filePath, { start, end });

        reply
          .code(206)
          .header('Content-Range', `bytes ${start}-${end}/${effectiveTotalBytes}`)
          .header('Accept-Ranges', 'bytes')
          .header('Content-Length', clamped.chunksize)
          .header('Content-Type', contentType);

        return reply.send(fileStream);
      }

      const { start, end, chunksize } = rangeInfo;
      const fileStream = fs.createReadStream(filePath, { start, end });

      reply
        .code(206)
        .header('Content-Range', `bytes ${start}-${end}/${fileSize}`)
        .header('Accept-Ranges', 'bytes')
        .header('Content-Length', chunksize)
        .header('Content-Type', contentType);

      return reply.send(fileStream);
    }

    if (!fullAccess) {
      const end = previewMaxEnd;
      const len = end + 1;
      const fileStream = fs.createReadStream(filePath, { start: 0, end });

      return reply
        .code(200)
        .header('Content-Length', len)
        .header('Content-Type', contentType)
        .header('Accept-Ranges', 'bytes')
        .send(fileStream);
    }

    const fileStream = fs.createReadStream(filePath);

    reply
      .code(200)
      .header('Content-Length', fileSize)
      .header('Content-Type', contentType)
      .header('Accept-Ranges', 'bytes');

    return reply.send(fileStream);
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: '오디오 스트리밍 중 서버 오류 발생' });
  }
}
