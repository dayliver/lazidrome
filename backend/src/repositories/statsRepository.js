import { getDB } from '../db.js';
import { listExcludedDeviceIds, normalizeDeviceId } from './deviceRepository.js';
import {
  aggregateListenHabits,
  countPlaysByTrack,
  getPlayHistoryStorageZone,
  parsePlayedAt,
  rangeStartInZone,
  resolveStatsTimezone,
  sumListenSecByTrack,
} from '../lib/playHistoryTime.js';

const db = getDB();

const RANGES = new Set(['24h', '48h', '7d', '30d', 'all']);
/** 순위 차트 전용 */
export const CHART_RANGES = new Set(['7d', '30d', 'all']);
/** 습관 통계 기본 후보 */
export const HABIT_RANGES = new Set(['7d', '30d', 'all']);

/**
 * @param {'24h'|'48h'|'7d'|'30d'|'all'} range
 * @returns {{ sql: string, params: unknown[] } | null}
 */
function cutoffFilter(range) {
  switch (range) {
    case '24h':
      return { sql: `played_at >= datetime('now', '-24 hours')`, params: [] };
    case '48h':
      return { sql: `played_at >= datetime('now', '-48 hours')`, params: [] };
    case '7d':
      return { sql: `played_at >= datetime('now', '-7 days')`, params: [] };
    case '30d':
      return { sql: `played_at >= datetime('now', '-30 days')`, params: [] };
    case 'all':
      return { sql: '1=1', params: [] };
    default:
      return null;
  }
}

/**
 * 기기 스코프 필터.
 * - `deviceId` 지정: 그 기기만. 사용자가 명시적으로 고른 것이므로 제외 플래그는 무시한다.
 * - 미지정: `exclude_from_stats`로 표시된 기기의 재생만 뺀다.
 *   `device_id IS NULL`(기기 미상 — 옛 기록·옛 클라이언트)은 항상 포함.
 * @param {string | null | undefined} deviceId
 * @param {string} column play_history의 device_id 컬럼 참조(별칭 포함)
 * @returns {{ sql: string, params: unknown[] }}
 */
function deviceScopeFilter(deviceId, column = 'device_id') {
  const id = normalizeDeviceId(deviceId);
  if (id) return { sql: `${column} = ?`, params: [id] };

  const excluded = listExcludedDeviceIds();
  if (!excluded.length) return { sql: '1=1', params: [] };
  const placeholders = excluded.map(() => '?').join(',');
  return {
    sql: `(${column} IS NULL OR ${column} NOT IN (${placeholders}))`,
    params: excluded,
  };
}

/**
 * 시간대(로컬 시각 기준): 아침 &lt;8, 오전 8–12, 오후 12–17, 저녁 17+
 */
export function getPlayCountsByTimeOfDay(range, deviceId = null) {
  const f = cutoffFilter(range);
  if (!f) return null;
  const d = deviceScopeFilter(deviceId);
  const row = db
    .prepare(
      `
    SELECT
      SUM(CASE WHEN CAST(strftime('%H', played_at) AS INTEGER) < 8 THEN 1 ELSE 0 END) AS dawn,
      SUM(CASE WHEN CAST(strftime('%H', played_at) AS INTEGER) >= 8 AND CAST(strftime('%H', played_at) AS INTEGER) < 12 THEN 1 ELSE 0 END) AS morning,
      SUM(CASE WHEN CAST(strftime('%H', played_at) AS INTEGER) >= 12 AND CAST(strftime('%H', played_at) AS INTEGER) < 17 THEN 1 ELSE 0 END) AS afternoon,
      SUM(CASE WHEN CAST(strftime('%H', played_at) AS INTEGER) >= 17 THEN 1 ELSE 0 END) AS evening
    FROM play_history
    WHERE ${f.sql} AND ${d.sql}
  `
    )
    .get(...f.params, ...d.params);

  return {
    dawn: Number(row?.dawn) || 0,
    morning: Number(row?.morning) || 0,
    afternoon: Number(row?.afternoon) || 0,
    evening: Number(row?.evening) || 0,
  };
}

/** 시간 단위 시리즈 (24h / 48h): 라벨 YYYY-MM-DD HH */
export function getPlaySeriesHourly(range, deviceId = null) {
  const f = cutoffFilter(range);
  if (!f || (range !== '24h' && range !== '48h')) return null;
  const d = deviceScopeFilter(deviceId);

  const rows = db
    .prepare(
      `
    SELECT strftime('%Y-%m-%d %H', played_at) AS label, COUNT(*) AS cnt
    FROM play_history
    WHERE ${f.sql} AND ${d.sql}
    GROUP BY strftime('%Y-%m-%d %H', played_at)
    ORDER BY label
  `
    )
    .all(...f.params, ...d.params);

  return rows.map((r) => ({ label: r.label, count: Number(r.cnt) || 0 }));
}

/** 일 단위 시리즈 (7d / 30d) */
export function getPlaySeriesDaily(range, deviceId = null) {
  const f = cutoffFilter(range);
  if (!f || (range !== '7d' && range !== '30d')) return null;
  const d = deviceScopeFilter(deviceId);

  return db
    .prepare(
      `
    SELECT date(played_at) AS label, COUNT(*) AS cnt
    FROM play_history
    WHERE ${f.sql} AND ${d.sql}
    GROUP BY date(played_at)
    ORDER BY label
  `
    )
    .all(...f.params, ...d.params)
    .map((r) => ({ label: r.label, count: Number(r.cnt) || 0 }));
}

/** 통산: 월 단위 */
export function getPlaySeriesMonthlyAllTime(deviceId = null) {
  const d = deviceScopeFilter(deviceId);
  return db
    .prepare(
      `
    SELECT strftime('%Y-%m', played_at) AS label, COUNT(*) AS cnt
    FROM play_history
    WHERE ${d.sql}
    GROUP BY strftime('%Y-%m', played_at)
    ORDER BY label
  `
    )
    .all(...d.params)
    .map((r) => ({ label: r.label, count: Number(r.cnt) || 0 }));
}

/**
 * range 컷오프 인스턴트를 저장 타임존의 로컬 문자열('YYYY-MM-DD HH:MM:SS')로 변환.
 * DB의 played_at 문자열(저장 타임존 기준)과 사전순 비교가 시각 비교와 동일해진다.
 */
function cutoffStringForRange(range, statsZone) {
  const start = rangeStartInZone(range, statsZone);
  if (!start) return null;
  return start.setZone(getPlayHistoryStorageZone()).toFormat('yyyy-MM-dd HH:mm:ss');
}

/** 기간 내 이벤트만 SQL에서 필터해 로드 (기존 filterEventsByRange와 동일한 인스턴트 컷오프) */
function loadPlayHistoryEvents(range = 'all', statsZone = 'UTC', deviceId = null) {
  const cutoff = cutoffStringForRange(range, statsZone);
  const d = deviceScopeFilter(deviceId, 'h.device_id');
  const rows = cutoff
    ? db
        .prepare(
          `
    SELECT h.played_at, h.track_id AS track_id, COALESCE(h.listened_sec, 0) AS listen_sec
    FROM play_history h
    WHERE h.played_at >= ? AND ${d.sql}
  `
        )
        .all(cutoff, ...d.params)
    : db
        .prepare(
          `
    SELECT h.played_at, h.track_id AS track_id, COALESCE(h.listened_sec, 0) AS listen_sec
    FROM play_history h
    WHERE ${d.sql}
  `
        )
        .all(...d.params);
  return rows
    .map((r) => {
      const playedAt = parsePlayedAt(r.played_at);
      if (!playedAt) return null;
      return {
        playedAt,
        trackId: String(r.track_id),
        listenSec: Number(r.listen_sec) || 0,
      };
    })
    .filter(Boolean);
}

/** 습관·순위 차트: 사용자 IANA 타임존 기준 집계 */
export function getHabitStatsPayload(range, timezoneRaw, deviceId = null) {
  if (!HABIT_RANGES.has(range)) return null;
  const statsZone = resolveStatsTimezone(timezoneRaw);
  const storageZone = getPlayHistoryStorageZone();
  const inRange = loadPlayHistoryEvents(range, statsZone, deviceId);
  const { totalListenSec, dayOfWeek, timeOfDay } = aggregateListenHabits(inRange, statsZone);
  return {
    range,
    timezone: statsZone,
    storageZone,
    deviceId: normalizeDeviceId(deviceId),
    totalListenSec,
    dayOfWeek,
    timeOfDay,
  };
}

export function getPlayStatsPayload(range, deviceId = null) {
  if (!RANGES.has(range)) return null;

  const timeOfDay = getPlayCountsByTimeOfDay(range, deviceId);
  let granularity = 'day';
  let series = [];

  if (range === '24h' || range === '48h') {
    granularity = 'hour';
    series = getPlaySeriesHourly(range, deviceId) || [];
  } else if (range === '7d' || range === '30d') {
    granularity = 'day';
    series = getPlaySeriesDaily(range, deviceId) || [];
  } else {
    granularity = 'month';
    series = getPlaySeriesMonthlyAllTime(deviceId);
  }

  return {
    range,
    granularity,
    series,
    timeOfDay,
    deviceId: normalizeDeviceId(deviceId),
  };
}

const TRACK_LIST_COLUMNS = `
    t.id, t.title, t.rating, t.starred,
    COALESCE(t.year, alb.year) AS year, t.tags, t.play_count, t.last_played,
    COALESCE(t.volume_pct, 100) AS volume_pct,
    t.custom_cover_type, f.duration, f.format, f.bitrate,
    alb.id as albumId, alb.name as albumName, alb.cover_type as albumCoverType,
    GROUP_CONCAT(a.name, ', ') as artist
`;

const TRACK_LIST_JOINS = `
  FROM track_metadata t
  JOIN track_filedata f ON t.file_id = f.id
  LEFT JOIN album_tracks at ON t.id = at.track_id AND at.is_primary = 1
  LEFT JOIN albums alb ON at.album_id = alb.id
  LEFT JOIN track_artists ta ON t.id = ta.track_id
  LEFT JOIN artists a ON ta.artist_id = a.id
`;

const GROUP_BY_TRACK = 'GROUP BY t.id';

function fetchTracksByIdsOrdered(trackIds) {
  if (!trackIds.length) return [];
  const placeholders = trackIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `
    SELECT ${TRACK_LIST_COLUMNS}
    ${TRACK_LIST_JOINS}
    WHERE t.id IN (${placeholders})
    ${GROUP_BY_TRACK}
  `
    )
    .all(...trackIds);
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  return trackIds.map((id) => byId[id]).filter(Boolean);
}

/** 상위 후보 트랙만 통산 재생/청취를 SQL 집계 (전 이력 로드 대체) */
function fetchAllTimeStatsForTracks(trackIds, deviceId = null) {
  const map = new Map();
  if (!trackIds.length) return map;
  const placeholders = trackIds.map(() => '?').join(',');
  const d = deviceScopeFilter(deviceId);
  const rows = db
    .prepare(
      `
    SELECT track_id, COUNT(*) AS plays, SUM(COALESCE(listened_sec, 0)) AS listen_sec
    FROM play_history
    WHERE track_id IN (${placeholders}) AND ${d.sql}
    GROUP BY track_id
  `
    )
    .all(...trackIds, ...d.params);
  for (const r of rows) {
    map.set(String(r.track_id), {
      plays: Number(r.plays) || 0,
      listenSec: Number(r.listen_sec) || 0,
    });
  }
  return map;
}

/** play_history 기간 내 청취 초 합 → 별점 → 통산 청취 초 */
function topTracksFromEvents(periodEv, limit = 20, deviceId = null) {
  const periodListen = sumListenSecByTrack(periodEv);
  const periodPlays = countPlaysByTrack(periodEv);

  const preRanked = [...periodListen.entries()].sort((a, b) => b[1] - a[1]);
  const topIds = preRanked.slice(0, Math.min(limit * 3, preRanked.length)).map(([id]) => id);
  const allTime = fetchAllTimeStatsForTracks(topIds, deviceId);

  const ranked = topIds.map((trackId) => ({
    trackId,
    periodListenSec: periodListen.get(trackId) || 0,
    allTimeListenSec: allTime.get(trackId)?.listenSec || 0,
    periodPlays: periodPlays.get(trackId) || 0,
    allTimePlays: allTime.get(trackId)?.plays || 0,
  }));

  const tracks = fetchTracksByIdsOrdered(topIds);
  const meta = Object.fromEntries(ranked.map((r) => [r.trackId, r]));

  return tracks
    .map((t) => ({
      ...t,
      period_listen_sec: meta[t.id]?.periodListenSec ?? 0,
      all_time_listen_sec: meta[t.id]?.allTimeListenSec ?? 0,
      period_plays: meta[t.id]?.periodPlays ?? 0,
      all_time_plays: meta[t.id]?.allTimePlays ?? 0,
    }))
    .sort(
      (a, b) =>
        (meta[b.id]?.periodListenSec ?? 0) - (meta[a.id]?.periodListenSec ?? 0) ||
        (Number(b.rating) || 0) - (Number(a.rating) || 0) ||
        (meta[b.id]?.allTimeListenSec ?? 0) - (meta[a.id]?.allTimeListenSec ?? 0) ||
        String(a.title || '').localeCompare(String(b.title || ''), undefined, {
          sensitivity: 'base',
        })
    )
    .slice(0, limit);
}

/**
 * 기간 합계(차트 헤더용): 총 재생 수, 청취 초, 고유 트랙 수.
 * top tracks가 잘라 보내는 limit과 무관하게
 * 그 기간의 모든 play_history 이벤트를 집계한다.
 */
function chartTotalsFromEvents(periodEv) {
  const periodListen = sumListenSecByTrack(periodEv);
  let totalListenSec = 0;
  for (const sec of periodListen.values()) totalListenSec += sec;
  const listenedTrackIds = [...periodListen.entries()]
    .filter(([, sec]) => sec > 0)
    .map(([trackId]) => trackId);
  return {
    totalPlays: periodEv.length,
    totalListenSec,
    uniqueTrackCount: listenedTrackIds.length,
    uniqueArtistCount: countUniqueArtistsInPeriod(listenedTrackIds),
  };
}

/**
 * 트랙별 참여 아티스트 ID (곡 `track_artists` ∪ 대표 앨범 `album_artists`, 중복 제거).
 * @param {string[]} trackIds
 * @returns {Map<string, Set<string>>}
 */
function buildUniqueArtistIdsByTrack(trackIds) {
  const map = new Map();
  if (!trackIds.length) return map;

  const ensure = (trackId) => {
    const key = String(trackId);
    if (!map.has(key)) map.set(key, new Set());
    return map.get(key);
  };

  const placeholders = trackIds.map(() => '?').join(',');

  const trackArtistRows = db
    .prepare(
      `
    SELECT track_id, artist_id
    FROM track_artists
    WHERE track_id IN (${placeholders})
  `
    )
    .all(...trackIds);

  for (const row of trackArtistRows) {
    if (row.artist_id) ensure(row.track_id).add(String(row.artist_id));
  }

  const albumArtistRows = db
    .prepare(
      `
    SELECT at.track_id AS track_id, aa.artist_id AS artist_id
    FROM album_tracks at
    JOIN album_artists aa ON aa.album_id = at.album_id
    WHERE at.track_id IN (${placeholders}) AND at.is_primary = 1
  `
    )
    .all(...trackIds);

  for (const row of albumArtistRows) {
    if (row.artist_id) ensure(row.track_id).add(String(row.artist_id));
  }

  return map;
}

/** 기간 내 청취 시간이 잡힌 고유 아티스트 수 */
function countUniqueArtistsInPeriod(trackIds) {
  if (!trackIds?.length) return 0;
  const byTrack = buildUniqueArtistIdsByTrack(trackIds);
  const unique = new Set();
  for (const ids of byTrack.values()) {
    for (const id of ids) unique.add(id);
  }
  return unique.size;
}

/**
 * 기간 내 play_history: 재생 1회의 listened_sec를 해당 곡 참여 아티스트(곡+대표앨범 합집합)마다 합산.
 * 동일 아티스트가 곡·앨범 양쪽에 있어도 그 재생에서는 1회만 집계.
 */
function topArtistsFromEvents(periodEv, limit = 20) {
  if (!periodEv.length) return [];

  const trackIds = [...new Set(periodEv.map((ev) => ev.trackId))];
  const artistsByTrack = buildUniqueArtistIdsByTrack(trackIds);

  const artistListenSec = new Map();
  const artistPlays = new Map();
  for (const ev of periodEv) {
    const sec = Number(ev.listenSec) || 0;
    const artistIds = artistsByTrack.get(String(ev.trackId));
    if (!artistIds?.size) continue;
    for (const artistId of artistIds) {
      artistPlays.set(artistId, (artistPlays.get(artistId) || 0) + 1);
      if (sec > 0) {
        artistListenSec.set(artistId, (artistListenSec.get(artistId) || 0) + sec);
      }
    }
  }

  if (!artistListenSec.size && !artistPlays.size) return [];

  const sortedArtistIds = [...artistListenSec.entries()]
    .sort(
      (a, b) =>
        b[1] - a[1] ||
        (artistPlays.get(b[0]) || 0) - (artistPlays.get(a[0]) || 0) ||
        String(a[0]).localeCompare(String(b[0]), undefined, { sensitivity: 'base' })
    )
    .slice(0, limit)
    .map(([id]) => id);

  const artPlaceholders = sortedArtistIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `
    SELECT id, name, cover_type
    FROM artists
    WHERE id IN (${artPlaceholders})
  `
    )
    .all(...sortedArtistIds);
  const byId = Object.fromEntries(rows.map((a) => [String(a.id), a]));

  return sortedArtistIds
    .map((id) => {
      const row = byId[id];
      if (!row) return null;
      return {
        ...row,
        period_listen_sec: artistListenSec.get(id) || 0,
        period_plays: artistPlays.get(id) || 0,
      };
    })
    .filter(Boolean);
}

/** 대표 앨범 기준으로 롤업 */
function topAlbumsFromEvents(periodEv, limit = 20) {
  const periodListen = sumListenSecByTrack(periodEv);
  if (!periodListen.size) return [];

  const trackIds = [...periodListen.keys()];
  const placeholders = trackIds.map(() => '?').join(',');
  const albumRows = db
    .prepare(
      `
    SELECT at.track_id AS track_id, at.album_id AS album_id
    FROM album_tracks at
    WHERE at.track_id IN (${placeholders}) AND at.is_primary = 1
  `
    )
    .all(...trackIds);

  const albumListenSec = new Map();
  for (const row of albumRows) {
    const sec = periodListen.get(row.track_id) || 0;
    if (sec <= 0) continue;
    albumListenSec.set(row.album_id, (albumListenSec.get(row.album_id) || 0) + sec);
  }

  const sortedAlbumIds = [...albumListenSec.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
  if (!sortedAlbumIds.length) return [];

  const albPlaceholders = sortedAlbumIds.map(() => '?').join(',');
  const albums = db
    .prepare(
      `
    SELECT id, name, cover_type as albumCoverType, year
    FROM albums
    WHERE id IN (${albPlaceholders})
  `
    )
    .all(...sortedAlbumIds);
  const byId = Object.fromEntries(albums.map((a) => [a.id, a]));
  return sortedAlbumIds.map((id) => ({
    ...byId[id],
    period_listen_sec: albumListenSec.get(id) || 0,
  }));
}

/**
 * `/api/stats/top` 통합 페이로드.
 * 기간 이벤트를 SQL 필터로 1회만 로드해 tracks/albums/artists/totals를 모두 계산한다.
 * @param {{ tracks?: boolean, albums?: boolean, artists?: boolean, totals?: boolean, deviceId?: string | null }} [options]
 */
export function getStatsTopPayload(range, limit = 20, timezoneRaw, options = {}) {
  if (!CHART_RANGES.has(range) && !RANGES.has(range)) return null;
  const want = {
    tracks: options.tracks !== false,
    albums: options.albums !== false,
    artists: options.artists !== false,
    totals: options.totals !== false,
  };
  const deviceId = normalizeDeviceId(options.deviceId);
  const statsZone = resolveStatsTimezone(timezoneRaw);
  const periodEv = loadPlayHistoryEvents(range, statsZone, deviceId);
  return {
    deviceId,
    tracks: want.tracks ? topTracksFromEvents(periodEv, limit, deviceId) : [],
    albums: want.albums ? topAlbumsFromEvents(periodEv, limit) : [],
    artists: want.artists ? topArtistsFromEvents(periodEv, limit) : [],
    totals: want.totals
      ? chartTotalsFromEvents(periodEv)
      : {
          totalPlays: 0,
          totalListenSec: 0,
          uniqueTrackCount: 0,
          uniqueArtistCount: 0,
        },
  };
}

export { RANGES };
