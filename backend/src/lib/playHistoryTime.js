import { DateTime } from 'luxon';

export const HABIT_RANGES = new Set(['7d', '30d', 'all']);
export const CHART_RANGES = new Set(['7d', '30d', 'all', '24h', '48h']);

/** 시간대별 습관 버킷 (라벨은 클라이언트 i18n) */
export const TIME_HABIT_BUCKETS = [
  { key: 'early', match: (h) => h < 8 },
  { key: 'h08', match: (h) => h === 8 },
  { key: 'h09', match: (h) => h === 9 },
  { key: 'h10', match: (h) => h === 10 },
  { key: 'h11', match: (h) => h === 11 },
  { key: 'h12', match: (h) => h === 12 },
  { key: 'h13', match: (h) => h === 13 },
  { key: 'h14', match: (h) => h === 14 },
  { key: 'h15', match: (h) => h === 15 },
  { key: 'h16', match: (h) => h === 16 },
  { key: 'h17', match: (h) => h === 17 },
  { key: 'h18', match: (h) => h === 18 },
  { key: 'h19', match: (h) => h === 19 },
  { key: 'h20', match: (h) => h === 20 },
  { key: 'h21', match: (h) => h === 21 },
  { key: 'night', match: (h) => h >= 22 },
];

/** DB `played_at`가 기록될 때의 기준 타임존 (서버 OS 또는 .env) */
export function getPlayHistoryStorageZone() {
  const fromEnv = process.env.PLAY_HISTORY_STORAGE_ZONE?.trim();
  if (fromEnv) return fromEnv;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function isValidIanaTimezone(tz) {
  if (!tz || typeof tz !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function resolveStatsTimezone(raw) {
  const tz = String(raw || '').trim();
  if (tz && isValidIanaTimezone(tz)) return tz;
  return 'UTC';
}

/**
 * SQLite `played_at` → Luxon (저장 시점 타임존으로 해석)
 * @param {string} playedAt
 * @returns {import('luxon').DateTime | null}
 */
export function parsePlayedAt(playedAt) {
  const s = String(playedAt || '').trim();
  if (!s) return null;
  const storageZone = getPlayHistoryStorageZone();
  let dt = DateTime.fromSQL(s, { zone: storageZone });
  if (!dt.isValid) {
    dt = DateTime.fromISO(s, { zone: storageZone });
  }
  return dt.isValid ? dt : null;
}

/**
 * @param {string} range
 * @param {string} statsZone
 * @returns {import('luxon').DateTime | null}
 */
export function rangeStartInZone(range, statsZone) {
  const now = DateTime.now().setZone(statsZone);
  switch (range) {
    case '24h':
      return now.minus({ hours: 24 });
    case '48h':
      return now.minus({ hours: 48 });
    case '7d':
      return now.minus({ days: 7 });
    case '30d':
      return now.minus({ days: 30 });
    case 'all':
      return null;
    default:
      return null;
  }
}

/** Luxon weekday (1=Mon … 7=Sun) → SQLite %w (0=Sun … 6=Sat) */
export function luxonWeekdayToSqlDow(weekday) {
  return weekday === 7 ? 0 : weekday;
}

/**
 * @param {{ playedAt: import('luxon').DateTime, durationSec: number, trackId?: number }[]} events
 * @param {string} range
 * @param {string} statsZone
 */
export function filterEventsByRange(events, range, statsZone) {
  const start = rangeStartInZone(range, statsZone);
  if (!start) return events;
  return events.filter((ev) => {
    const local = ev.playedAt.setZone(statsZone);
    return local >= start;
  });
}

/**
 * @param {{ playedAt: import('luxon').DateTime, durationSec: number }[]} events
 * @param {string} statsZone
 */
export function aggregateListenHabits(events, statsZone) {
  const dowSec = Array(7).fill(0);
  const hourSec = {};
  let totalListenSec = 0;

  for (const ev of events) {
    const local = ev.playedAt.setZone(statsZone);
    const dow = luxonWeekdayToSqlDow(local.weekday);
    const hour = local.hour;
    const sec = ev.durationSec;
    dowSec[dow] += sec;
    hourSec[hour] = (hourSec[hour] || 0) + sec;
    totalListenSec += sec;
  }

  const dayOfWeek = dowSec.map((listenSec, dow) => ({ dow, listenSec }));
  const timeOfDay = TIME_HABIT_BUCKETS.map((b) => {
    let listenSec = 0;
    for (const [hourStr, sec] of Object.entries(hourSec)) {
      const hour = Number(hourStr);
      if (b.match(hour)) listenSec += sec;
    }
    return { key: b.key, listenSec };
  });

  return { totalListenSec, dayOfWeek, timeOfDay };
}

/**
 * @param {{ playedAt: import('luxon').DateTime, trackId: number }[]} events
 */
export function countPlaysByTrack(events) {
  const counts = new Map();
  for (const ev of events) {
    counts.set(ev.trackId, (counts.get(ev.trackId) || 0) + 1);
  }
  return counts;
}
