import { recordTrackPlayWithHistory, getTrackScrobbleMeta, markPlayHistoryScrobbled } from '../repositories/trackRepository.js';
import { lastfmService } from '../services/lastfmService.js';

export async function postTrackPlayHandler(request, reply) {
  const { id } = request.params;
  const body = request.body && typeof request.body === 'object' ? request.body : {};
  const rawPeak = body.position_peak_sec ?? body.positionPeakSec;
  const positionPeakSec = rawPeak === undefined || rawPeak === null ? NaN : Number(rawPeak);

  if (!Number.isFinite(positionPeakSec) || positionPeakSec < 0) {
    return reply.code(400).send({
      success: false,
      error: 'position_peak_sec(재생 중 도달한 최대 위치, 초)가 필요합니다.',
    });
  }

  try {
    const result = recordTrackPlayWithHistory(id, positionPeakSec);
    if (result.notFound) return reply.code(404).send({ success: false, error: 'Track not found' });
    if (result.skipped) {
      return {
        success: true,
        skipped: true,
        data: { id, play_count: result.play_count },
      };
    }

    if (result.recorded && result.playHistoryId != null) {
      void (async () => {
        const hid = result.playHistoryId;
        const meta = getTrackScrobbleMeta(id);
        if (!meta?.artist || !meta?.title) {
          request.log.debug(
            { trackId: id, playHistoryId: hid },
            'Last.fm scrobble skipped: missing primary artist or title meta'
          );
          return;
        }
        const out = await lastfmService.scrobble({
          artist: meta.artist,
          track: meta.title,
          album: meta.album || null,
          durationSec: meta.duration_sec,
          timestampSec: Math.floor(Date.now() / 1000),
        });
        if (out.ok) markPlayHistoryScrobbled(hid, 1);
        else
          request.log.warn(
            {
              trackId: id,
              playHistoryId: hid,
              lastfmError: out.error,
              lastfmMessage: out.message,
            },
            'Last.fm scrobble failed'
          );
      })();
    }

    return { success: true, data: { id, play_count: result.play_count } };
  } catch (err) {
    request.log.error(err);
    return reply.code(500).send({ error: '재생 기록 저장 중 오류가 발생했습니다.' });
  }
}
