import { parsePlaylistTrackIds } from '../lib/hlsPlaylist.js';
import {
  continuousStreamSlotsAvailable,
  spawnContinuousMp3Pipe,
} from '../lib/continuousStream.js';
import { getTrackPhysicalFile } from '../services/streamService.js';

/**
 * Continuous queue audio: ffmpeg concatenates tracks into one MP3 pipe so the
 * client keeps a single media session (screen-off next-track on Android).
 *
 * Auth: global JWT preHandler (Bearer or ?token= for <audio src>).
 */
export async function streamContinuousHandler(request, reply) {
  const ids = parsePlaylistTrackIds(request.query?.ids);
  if (!ids.length) {
    return reply.code(400).send({ error: 'ids query required (comma-separated track ids)' });
  }

  if (!continuousStreamSlotsAvailable()) {
    return reply.code(503).send({ error: 'Too many continuous streams; try again shortly' });
  }

  const paths = [];
  const resolvedIds = [];
  for (const id of ids) {
    const fileInfo = getTrackPhysicalFile(id);
    if (!fileInfo?.path) continue;
    paths.push(fileInfo.path);
    resolvedIds.push(String(id));
  }

  if (!paths.length) {
    return reply.code(404).send({ error: 'No playable tracks found for ids' });
  }

  let pipe;
  try {
    pipe = spawnContinuousMp3Pipe(paths);
  } catch (err) {
    const msg = err?.message || String(err);
    if (msg === 'CONTINUOUS_BUSY') {
      return reply.code(503).send({ error: 'Too many continuous streams; try again shortly' });
    }
    request.log.error({ err }, 'continuous stream spawn failed');
    return reply.code(500).send({ error: 'Failed to start continuous stream (is ffmpeg installed?)' });
  }

  const { child, cleanup } = pipe;

  const onAbort = () => cleanup();
  request.raw.on('close', onAbort);
  reply.raw.on('close', onAbort);

  child.stderr?.on('data', (chunk) => {
    const text = chunk.toString().trim();
    if (text) request.log.warn({ ffmpeg: text.slice(0, 400) }, 'continuous stream ffmpeg');
  });

  child.on('error', (err) => {
    request.log.error({ err }, 'continuous stream ffmpeg process error');
    cleanup();
    if (!reply.sent && !reply.raw.headersSent) {
      try {
        reply.code(500).send({ error: 'Continuous stream encoder failed' });
      } catch {
        /* ignore */
      }
    }
  });

  // If ffmpeg exits before any stdout, surface an error when possible.
  let gotData = false;
  child.stdout?.once('data', () => {
    gotData = true;
  });
  child.on('close', (code) => {
    if (!gotData && code && code !== 0 && !reply.raw.headersSent) {
      try {
        reply.code(500).send({ error: 'Continuous stream encoder exited early' });
      } catch {
        /* ignore */
      }
    }
  });

  return reply
    .code(200)
    .header('Content-Type', 'audio/mpeg')
    .header('Cache-Control', 'no-store')
    .header('X-Lazidrome-Continuous', '1')
    .header('X-Lazidrome-Track-Ids', resolvedIds.join(','))
    .send(child.stdout);
}
