import { getDB } from '../db.js';
import {
  aggregateListenHabits,
  countPlaysByTrack,
  filterEventsByRange,
  getPlayHistoryStorageZone,
  parsePlayedAt,
  resolveStatsTimezone,
  sumListenSecByTrack,
} from '../lib/playHistoryTime.js';

const db = getDB();

const RANGES = new Set(['24h', '48h', '7d', '30d', 'all']);
/** 순위 차트 전용 */
export const CHART_RANGES = new Set(['7d', '30d', 'all']);
/** 습관 통계 기본 후보 */
export const HABIT_RANGES = new Set(['7d', '30d', 'all']);

const LISTEN_FROM = `
  FROM play_history h
`;

function listenSecExpr() {
  return 'SUM(COALESCE(h.listened_sec, 0))';
}

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
 * 시간대(로컬 시각 기준): 아침 &lt;8, 오전 8–12, 오후 12–17, 저녁 17+
 */
export function getPlayCountsByTimeOfDay(range) {
  const f = cutoffFilter(range);
  if (!f) return null;
  const row = db
    .prepare(
      `
    SELECT
      SUM(CASE WHEN CAST(strftime('%H', played_at) AS INTEGER) < 8 THEN 1 ELSE 0 END) AS dawn,
      SUM(CASE WHEN CAST(strftime('%H', played_at) AS INTEGER) >= 8 AND CAST(strftime('%H', played_at) AS INTEGER) < 12 THEN 1 ELSE 0 END) AS morning,
      SUM(CASE WHEN CAST(strftime('%H', played_at) AS INTEGER) >= 12 AND CAST(strftime('%H', played_at) AS INTEGER) < 17 THEN 1 ELSE 0 END) AS afternoon,
      SUM(CASE WHEN CAST(strftime('%H', played_at) AS INTEGER) >= 17 THEN 1 ELSE 0 END) AS evening
    FROM play_history
    WHERE ${f.sql}
  `
    )
    .get(...f.params);

  return {
    dawn: Number(row?.dawn) || 0,
    morning: Number(row?.morning) || 0,
    afternoon: Number(row?.afternoon) || 0,
    evening: Number(row?.evening) || 0,
  };
}

/** 시간 단위 시리즈 (24h / 48h): 라벨 YYYY-MM-DD HH */
export function getPlaySeriesHourly(range) {
  const f = cutoffFilter(range);
  if (!f || (range !== '24h' && range !== '48h')) return null;

  const rows = db
    .prepare(
      `
    SELECT strftime('%Y-%m-%d %H', played_at) AS label, COUNT(*) AS cnt
    FROM play_history
    WHERE ${f.sql}
    GROUP BY strftime('%Y-%m-%d %H', played_at)
    ORDER BY label
  `
    )
    .all(...f.params);

  return rows.map((r) => ({ label: r.label, count: Number(r.cnt) || 0 }));
}

/** 일 단위 시리즈 (7d / 30d) */
export function getPlaySeriesDaily(range) {
  const f = cutoffFilter(range);
  if (!f || (range !== '7d' && range !== '30d')) return null;

  return db
    .prepare(
      `
    SELECT date(played_at) AS label, COUNT(*) AS cnt
    FROM play_history
    WHERE ${f.sql}
    GROUP BY date(played_at)
    ORDER BY label
  `
    )
    .all(...f.params)
    .map((r) => ({ label: r.label, count: Number(r.cnt) || 0 }));
}

/** 통산: 월 단위 */
export function getPlaySeriesMonthlyAllTime() {
  return db
    .prepare(
      `
    SELECT strftime('%Y-%m', played_at) AS label, COUNT(*) AS cnt
    FROM play_history
    GROUP BY strftime('%Y-%m', played_at)
    ORDER BY label
  `
    )
    .all()
    .map((r) => ({ label: r.label, count: Number(r.cnt) || 0 }));
}

/** 요일별 청취 시간 (월=1 … 일=0, SQLite %w) */
export function getListenSecondsByDayOfWeek(range) {
  const f = cutoffFilter(range);
  if (!f) return null;
  const rows = db
    .prepare(
      `
    SELECT CAST(strftime('%w', h.played_at) AS INTEGER) AS dow,
           ${listenSecExpr()} AS listen_sec
    ${LISTEN_FROM}
    WHERE ${f.sql.replaceAll('played_at', 'h.played_at')}
    GROUP BY dow
    ORDER BY dow
  `
    )
    .all(...f.params);

  const labels = ['일', '월', '화', '수', '목', '금', '토'];
  const byDow = Object.fromEntries(rows.map((r) => [Number(r.dow), Number(r.listen_sec) || 0]));
  return labels.map((label, dow) => ({
    dow,
    label,
    listenSec: byDow[dow] ?? 0,
  }));
}

const TIME_HABIT_BUCKETS = [
  { key: 'early', label: '8시 이전', match: (h) => h < 8 },
  { key: 'h08', label: '08시', match: (h) => h === 8 },
  { key: 'h09', label: '09시', match: (h) => h === 9 },
  { key: 'h10', label: '10시', match: (h) => h === 10 },
  { key: 'h11', label: '11시', match: (h) => h === 11 },
  { key: 'h12', label: '12시', match: (h) => h === 12 },
  { key: 'h13', label: '13시', match: (h) => h === 13 },
  { key: 'h14', label: '14시', match: (h) => h === 14 },
  { key: 'h15', label: '15시', match: (h) => h === 15 },
  { key: 'h16', label: '16시', match: (h) => h === 16 },
  { key: 'h17', label: '17시', match: (h) => h === 17 },
  { key: 'h18', label: '18시', match: (h) => h === 18 },
  { key: 'h19', label: '19시', match: (h) => h === 19 },
  { key: 'h20', label: '20시', match: (h) => h === 20 },
  { key: 'h21', label: '21시', match: (h) => h === 21 },
  { key: 'night', label: '22시 이후', match: (h) => h >= 22 },
];

/** 시간대별 청취 습관 (8시 전·22시 후 덩어리 + 8–21시 시간별) */
export function getListenSecondsByTimeHabit(range) {
  const f = cutoffFilter(range);
  if (!f) return null;
  const rows = db
    .prepare(
      `
    SELECT CAST(strftime('%H', h.played_at) AS INTEGER) AS hour,
           ${listenSecExpr()} AS listen_sec
    ${LISTEN_FROM}
    WHERE ${f.sql.replaceAll('played_at', 'h.played_at')}
    GROUP BY hour
  `
    )
    .all(...f.params);

  const byHour = Object.fromEntries(rows.map((r) => [Number(r.hour), Number(r.listen_sec) || 0]));
  return TIME_HABIT_BUCKETS.map((b) => {
    let listenSec = 0;
    for (const [hourStr, sec] of Object.entries(byHour)) {
      const hour = Number(hourStr);
      if (b.match(hour)) listenSec += sec;
    }
    return { key: b.key, label: b.label, listenSec };
  });
}

export function getTotalListenSeconds(range) {
  const f = cutoffFilter(range);
  if (!f) return 0;
  const row = db
    .prepare(
      `
    SELECT ${listenSecExpr()} AS listen_sec
    ${LISTEN_FROM}
    WHERE ${f.sql.replaceAll('played_at', 'h.played_at')}
  `
    )
    .get(...f.params);
  return Number(row?.listen_sec) || 0;
}

function loadPlayHistoryEvents() {
  const rows = db
    .prepare(
      `
    SELECT h.played_at, h.track_id AS track_id, COALESCE(h.listened_sec, 0) AS listen_sec
    FROM play_history h
  `
    )
    .all();
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

function getPlayHistoryEvents() {
  return loadPlayHistoryEvents();
}

/** 습관·순위 차트: 사용자 IANA 타임존 기준 집계 */
export function getHabitStatsPayload(range, timezoneRaw) {
  if (!HABIT_RANGES.has(range)) return null;
  const statsZone = resolveStatsTimezone(timezoneRaw);
  const storageZone = getPlayHistoryStorageZone();
  const all = getPlayHistoryEvents();
  const inRange = filterEventsByRange(all, range, statsZone);
  const { totalListenSec, dayOfWeek, timeOfDay } = aggregateListenHabits(inRange, statsZone);
  return {
    range,
    timezone: statsZone,
    storageZone,
    totalListenSec,
    dayOfWeek,
    timeOfDay,
  };
}

export function getPlayStatsPayload(range) {
  if (!RANGES.has(range)) return null;

  const timeOfDay = getPlayCountsByTimeOfDay(range);
  let granularity = 'day';
  let series = [];

  if (range === '24h' || range === '48h') {
    granularity = 'hour';
    series = getPlaySeriesHourly(range) || [];
  } else if (range === '7d' || range === '30d') {
    granularity = 'day';
    series = getPlaySeriesDaily(range) || [];
  } else {
    granularity = 'month';
    series = getPlaySeriesMonthlyAllTime();
  }

  return {
    range,
    granularity,
    series,
    timeOfDay,
  };
}

const TRACK_LIST_COLUMNS = `
    t.id, t.title, t.rating, t.starred, t.year, t.tags, t.play_count, t.last_played,
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

/** play_history 기간 내 청취 초 합 → 별점 → 통산 청취 초 */
export function getTopTracksByPlayEvents(range, limit = 20, timezoneRaw) {
  if (!CHART_RANGES.has(range) && !RANGES.has(range)) return [];
  const statsZone = resolveStatsTimezone(timezoneRaw);
  const all = getPlayHistoryEvents();
  const periodEv = filterEventsByRange(all, range, statsZone);
  const allTimeListen = sumListenSecByTrack(all);
  const periodListen = sumListenSecByTrack(periodEv);
  const allTimePlays = countPlaysByTrack(all);
  const periodPlays = countPlaysByTrack(periodEv);

  const ranked = [...periodListen.entries()]
    .map(([trackId, periodListenSec]) => ({
      trackId,
      periodListenSec,
      allTimeListenSec: allTimeListen.get(trackId) || 0,
      periodPlays: periodPlays.get(trackId) || 0,
      allTimePlays: allTimePlays.get(trackId) || 0,
    }))
    .sort((a, b) => b.periodListenSec - a.periodListenSec);

  const topIds = ranked.slice(0, Math.min(limit * 3, ranked.length)).map((r) => r.trackId);
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
 * `getTopTracksByPlayEvents`가 잘라 보내는 limit과 무관하게
 * 그 기간의 모든 play_history 이벤트를 집계한다.
 */
export function getChartTotals(range, timezoneRaw) {
  if (!CHART_RANGES.has(range) && !RANGES.has(range)) {
    return { totalPlays: 0, totalListenSec: 0, uniqueTrackCount: 0, uniqueArtistCount: 0 };
  }
  const statsZone = resolveStatsTimezone(timezoneRaw);
  const periodEv = filterEventsByRange(getPlayHistoryEvents(), range, statsZone);
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
export function getTopArtistsByPlayEvents(range, limit = 20, timezoneRaw) {
  if (!CHART_RANGES.has(range) && !RANGES.has(range)) return [];
  const statsZone = resolveStatsTimezone(timezoneRaw);
  const periodEv = filterEventsByRange(getPlayHistoryEvents(), range, statsZone);
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
export function getTopAlbumsByPlayEvents(range, limit = 20, timezoneRaw) {
  if (!CHART_RANGES.has(range) && !RANGES.has(range)) return [];
  const statsZone = resolveStatsTimezone(timezoneRaw);
  const periodEv = filterEventsByRange(getPlayHistoryEvents(), range, statsZone);
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

export { RANGES };
