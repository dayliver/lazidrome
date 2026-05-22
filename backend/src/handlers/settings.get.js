import { countTracks } from '../repositories/trackRepository.js';
import { getBackendBuildInfo } from '../lib/buildInfo.js';

/** 클라이언트용 서버 설정 요약 (비밀 값은 노출하지 않음) */
export async function getSettingsHandler(_request, _reply) {
  const apiKey = Boolean(process.env.LASTFM_API_KEY?.trim());
  const scrobble =
    apiKey &&
    Boolean(process.env.LASTFM_API_SECRET?.trim()) &&
    Boolean(process.env.LASTFM_SESSION_KEY?.trim());

  return {
    lastfm: {
      enrich: apiKey,
      scrobble,
    },
    library: {
      trackCount: countTracks(),
    },
    build: getBackendBuildInfo(),
  };
}
