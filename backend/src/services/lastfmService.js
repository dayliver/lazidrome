// backend/src/services/lastfmService.js

import crypto from 'node:crypto';

const BASE_URL = 'http://ws.audioscrobbler.com/2.0/';

/**
 * Last.fm 서명(api_sig): 키 알파벳 순으로 `key+value` 이어붙인 뒤 secret을 붙여 MD5
 * @param {Record<string, string>} params
 * @param {string} secret
 */
function signLastfmParams(params, secret) {
  const keys = Object.keys(params).filter((k) => k !== 'api_sig').sort();
  const s = keys.map((k) => k + params[k]).join('');
  return crypto.createHash('md5').update(s + secret, 'utf8').digest('hex');
}

/**
 * `track.scrobble` — `LASTFM_API_KEY`, `LASTFM_API_SECRET`, `LASTFM_SESSION_KEY`가 모두 있을 때만 시도
 * @returns {Promise<{ ok: boolean, error?: number, message?: string }>}
 */
async function scrobbleTrackWrite({
  artist,
  track,
  album = null,
  durationSec = null,
  timestampSec = null,
}) {
  const api_key = process.env.LASTFM_API_KEY;
  const api_secret = process.env.LASTFM_API_SECRET;
  const sk = process.env.LASTFM_SESSION_KEY;
  if (!api_key || !api_secret || !sk || !artist || !track) {
    return { ok: false, message: 'missing_env_or_meta' };
  }

  const ts = String(timestampSec ?? Math.floor(Date.now() / 1000));
  /** @type {Record<string, string>} */
  const params = {
    method: 'track.scrobble',
    api_key,
    sk,
    timestamp: ts,
    artist: String(artist).slice(0, 300),
    track: String(track).slice(0, 300),
    format: 'json',
  };
  if (album) params.album = String(album).slice(0, 300);
  if (durationSec != null && Number.isFinite(Number(durationSec)) && Number(durationSec) > 0) {
    params.duration = String(Math.round(Number(durationSec)));
  }
  params.api_sig = signLastfmParams(params, api_secret);

  try {
    const body = new URLSearchParams(params);
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = await res.json();
    if (!res.ok || data?.error) {
      const message = typeof data?.message === 'string' ? data.message : res.statusText;
      const code = typeof data?.error === 'number' ? data.error : undefined;
      return { ok: false, message, error: code };
    }
    if (data?.scrobbles) return { ok: true };
    return { ok: false, message: 'no_scrobbles_in_response' };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `fetch_error:${message}` };
  }
}

/**
 * Last.fm API 요청 URL을 생성하는 헬퍼 함수
 * @param {string} method - Last.fm API 메서드명
 * @param {object} params - 추가 파라미터
 */
const buildUrl = (method, params) => {
  // 💉 수정 코드: 함수 내부에서 런타임에 환경 변수를 읽어옵니다.
  const API_KEY = process.env.LASTFM_API_KEY; 
  
  if (!API_KEY) throw new Error('LASTFM_API_KEY가 설정되지 않았습니다.');

  const url = new URL(BASE_URL);
  url.searchParams.append('method', method);
  url.searchParams.append('api_key', API_KEY);
  url.searchParams.append('format', 'json');
  url.searchParams.append('autocorrect', '1');

  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.append(key, value);
  }
  
  return url.toString();
};

/**
 * 이미지 배열에서 가장 큰 이미지를 추출하는 헬퍼 함수
 */
const getBestImage = (imageArray) => {
  if (!imageArray || imageArray.length === 0) return null;
  // 'extralarge', 'large', 'medium', 'small' 순으로 탐색
  const best = imageArray.find(img => img.size === 'extralarge') 
            || imageArray.find(img => img.size === 'large')
            || imageArray[imageArray.length - 1];
  return best['#text'] || null;
};

export const lastfmService = {
  /**
   * 재생 확정(서버에서 play_history 기록 직후 등) 시 Last.fm에 스크롭 전송
   */
  scrobble: scrobbleTrackWrite,

  /**
   * 1. 아티스트 정보 가져오기
   * - 바이오그래피, 상위 태그, 비슷한 아티스트를 정규화하여 반환합니다.
   */
  async getArtistInfo(artistName) {
    try {
      const url = buildUrl('artist.getinfo', { artist: artistName });
      const response = await fetch(url);
      const data = await response.json();

      if (data.error || !data.artist) return null;

      const artist = data.artist;
      return {
        name: artist.name, // 교정된 정확한 이름
        imageUrl: getBestImage(artist.image),
        bio: artist.bio?.summary || '',
        tags: artist.tags?.tag?.map(t => t.name) || [],
        similar: artist.similar?.artist?.map(a => a.name) || []
      };
    } catch (error) {
      console.error(`[Last.fm] 아티스트 정보 조회 실패 (${artistName}):`, error);
      return null;
    }
  },

  /**
   * 2. 앨범 정보 가져오기
   * - 앨범 커버 아트, 앨범별 태그, 트랙리스트를 가져옵니다.
   */
  async getAlbumInfo(artistName, albumName) {
    try {
      const url = buildUrl('album.getinfo', { artist: artistName, album: albumName });
      const response = await fetch(url);
      const data = await response.json();

      if (data.error || !data.album) return null;

      const album = data.album;
      return {
        name: album.name,
        artist: album.artist,
        imageUrl: getBestImage(album.image),
        tags: album.tags?.tag?.map(t => t.name) || [],
        releaseDate: album.wiki?.published || null
      };
    } catch (error) {
      console.error(`[Last.fm] 앨범 정보 조회 실패 (${albumName}):`, error);
      return null;
    }
  },

  /**
   * 3. 트랙(곡) 정보 가져오기 (단순화 버전)
   * - track.getInfo 한 번만 호출하여 앨범, 커버, 태그를 가져옵니다.
   * - 태그가 비어있으면 억지로 찾지 않고 빈 배열을 반환합니다.
   */
  async getTrackInfo(artist, title) {
    try {
      const url = buildUrl('track.getInfo', { artist, track: title });
      const response = await fetch(url);
      const data = await response.json();

      // 메인 정보가 실패하면 의미가 없으므로 null 반환
      if (data.error || !data.track) return null;

      const track = data.track;

      // 💉 1. 태그 추출 (getInfo 응답에 포함된 toptags 사용)
      let tags = [];
      if (track.toptags && track.toptags.tag) {
        // Last.fm의 고질병: 결과가 1개일 땐 객체, 여러 개일 땐 배열로 오는 현상 방어
        let rawTags = Array.isArray(track.toptags.tag) 
          ? track.toptags.tag 
          : [track.toptags.tag];

        // getInfo에서 주는 태그는 count 정보가 없으므로 바로 이름만 매핑합니다.
        tags = rawTags.map(t => t.name);
      }

      // 💉 2. 앨범 정보 및 고해상도 커버 이미지 추출
      let albumName = track.album?.title || null;
      let imageUrl = null;
      if (track.album && track.album.image) {
        // 헬퍼 함수 재활용
        imageUrl = getBestImage(track.album.image);
      }

      // 최종적으로 예쁘게 조립된 객체 반환
      return {
        title: track.name,           // 오타 교정된 공식 곡 제목
        artist: track.artist?.name,  // 오타 교정된 공식 아티스트명
        albumName,                   // 앨범명
        imageUrl,                    // 고해상도 커버
        tags,                        // 태그 배열 (없으면 빈 배열)
        playcount: track.playcount,  // 글로벌 재생 횟수
        mbid: track.mbid
      };
    } catch (err) {
      console.error(`[Last.fm] 트랙 정보 조회 실패 (${title}):`, err.message);
      return null;
    }
  },

  async searchAlbums(query) {
    const API_KEY = process.env.LASTFM_API_KEY;
    const url = `http://ws.audioscrobbler.com/2.0/?method=album.search&album=${encodeURIComponent(query)}&api_key=${API_KEY}&format=json`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.error || !data.results?.albummatches?.album) return [];

    return data.results.albummatches.album.map(a => ({
      name: a.name,
      artist: a.artist,
      imageUrl: a.image?.find(img => img.size === 'extralarge')?.['#text'] || a.image?.[a.image.length - 1]?.['#text'],
      mbid: a.mbid
    }));
  }
};