import { getDB } from '../db.js';

const db = getDB();

/** 집계는 SQLite가 해석하는 `played_at` 문자열 기준이며, 호스트 OS 로컬 타임존에 따릅니다. */
export const PLAY_STATS_TIMEZONE_POLICY =
  'play_history.played_at는 SQLite CURRENT_TIMESTAMP/로컬 규칙으로 저장·집계됩니다. 브라우저 TZ와 다를 수 있습니다.';

const RANGES = new Set(['24h', '48h', '7d', '30d', 'all']);

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
    timezonePolicy: PLAY_STATS_TIMEZONE_POLICY,
    series,
    timeOfDay,
  };
}

const TRACK_LIST_SELECT = `
  SELECT
    t.id, t.title, t.rating, t.starred, t.year, t.tags, t.play_count, t.last_played,
    t.custom_cover_type, f.duration, f.format, f.bitrate,
    alb.id as albumId, alb.name as albumName, alb.cover_type as albumCoverType,
    GROUP_CONCAT(a.name, ', ') as artist
  FROM track_metadata t
  JOIN track_filedata f ON t.file_id = f.id
  LEFT JOIN album_tracks at ON t.id = at.track_id AND at.is_primary = 1
  LEFT JOIN albums alb ON at.album_id = alb.id
  LEFT JOIN track_artists ta ON t.id = ta.track_id
  LEFT JOIN artists a ON ta.artist_id = a.id
`;

const GROUP_BY_TRACK = 'GROUP BY t.id';

/** play_history 기간 내 이벤트 수 기준 상위 트랙 */
export function getTopTracksByPlayEvents(range, limit = 20) {
  const f = cutoffFilter(range);
  if (!f) return [];
  return db
    .prepare(
      `
    WITH ev AS (
      SELECT track_id, COUNT(*) AS ev_cnt
      FROM play_history
      WHERE ${f.sql}
      GROUP BY track_id
    )
    ${TRACK_LIST_SELECT}
    JOIN ev ON ev.track_id = t.id
    ${GROUP_BY_TRACK}, ev.ev_cnt
    ORDER BY ev.ev_cnt DESC, COALESCE(t.rating, 0) DESC, t.title
    LIMIT ?
  `
    )
    .all(...f.params, limit);
}

/** 대표 앨범 기준으로 롤업 */
export function getTopAlbumsByPlayEvents(range, limit = 20) {
  const f = cutoffFilter(range);
  if (!f) return [];
  return db
    .prepare(
      `
    WITH ev AS (
      SELECT track_id, COUNT(*) AS ev_cnt
      FROM play_history
      WHERE ${f.sql}
      GROUP BY track_id
    ),
    alb_plays AS (
      SELECT at.album_id AS album_id, SUM(ev.ev_cnt) AS play_events
      FROM ev
      JOIN album_tracks at ON at.track_id = ev.track_id AND at.is_primary = 1
      GROUP BY at.album_id
    )
    SELECT alb.id, alb.name, alb.cover_type as albumCoverType, alb.year, ap.play_events
    FROM alb_plays ap
    JOIN albums alb ON alb.id = ap.album_id
    ORDER BY ap.play_events DESC, alb.name
    LIMIT ?
  `
    )
    .all(...f.params, limit);
}

export { RANGES };
