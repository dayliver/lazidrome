import { getDB } from '../db.js';

const db = getDB();

const MAX_ID_LEN = 80;
const MAX_NAME_LEN = 120;

/** @param {unknown} raw */
export function normalizeDeviceId(raw) {
  const id = String(raw ?? '').trim().slice(0, MAX_ID_LEN);
  return id || null;
}

/** @param {unknown} raw */
function normalizeDeviceName(raw) {
  return String(raw ?? '').trim().slice(0, MAX_NAME_LEN);
}

/**
 * 기기 등록·갱신. 이름은 사용자가 바꿀 수 있으므로 자동 감지 이름으로 덮어쓰지 않는다
 * (최초 1회만 기록). 매 호출마다 last_seen_at은 갱신.
 * @returns {string | null} 정규화된 device id
 */
export function touchDevice(deviceId, deviceName) {
  const id = normalizeDeviceId(deviceId);
  if (!id) return null;
  const name = normalizeDeviceName(deviceName) || 'Device';
  db.prepare(
    `INSERT INTO playback_devices (id, name, last_seen_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET last_seen_at = CURRENT_TIMESTAMP`
  ).run(id, name);
  return id;
}

/** 재생 수·최근 재생을 붙인 기기 목록 (최근 사용 순) */
export function listDevices() {
  return db
    .prepare(
      `SELECT
         d.id,
         d.name,
         d.exclude_from_stats,
         d.last_seen_at,
         d.created_at,
         (SELECT COUNT(*) FROM play_history h WHERE h.device_id = d.id) AS play_count,
         (SELECT MAX(h.played_at) FROM play_history h WHERE h.device_id = d.id) AS last_played_at
       FROM playback_devices d
       ORDER BY d.last_seen_at DESC, d.name ASC`
    )
    .all()
    .map((row) => ({ ...row, exclude_from_stats: !!row.exclude_from_stats }));
}

export function findDevice(deviceId) {
  const id = normalizeDeviceId(deviceId);
  if (!id) return null;
  const row = db.prepare('SELECT * FROM playback_devices WHERE id = ?').get(id);
  return row ? { ...row, exclude_from_stats: !!row.exclude_from_stats } : null;
}

export function renameDevice(deviceId, name) {
  const id = normalizeDeviceId(deviceId);
  const nextName = normalizeDeviceName(name);
  if (!id || !nextName) return 0;
  return db.prepare('UPDATE playback_devices SET name = ? WHERE id = ?').run(nextName, id).changes;
}

export function setDeviceExcludeFromStats(deviceId, exclude) {
  const id = normalizeDeviceId(deviceId);
  if (!id) return 0;
  return db
    .prepare('UPDATE playback_devices SET exclude_from_stats = ? WHERE id = ?')
    .run(exclude ? 1 : 0, id).changes;
}

/** 기기 행만 제거. play_history.device_id는 소프트 참조라 기록은 남는다. */
export function deleteDevice(deviceId) {
  const id = normalizeDeviceId(deviceId);
  if (!id) return 0;
  return db.prepare('DELETE FROM playback_devices WHERE id = ?').run(id).changes;
}

/** 통계에서 제외된 기기 id 목록 */
export function listExcludedDeviceIds() {
  return db
    .prepare('SELECT id FROM playback_devices WHERE exclude_from_stats = 1')
    .all()
    .map((r) => String(r.id));
}

/**
 * 특정 기기의 재생 기록 삭제. from/to는 'YYYY-MM-DD HH:MM:SS'(저장 타임존) 문자열.
 * play_count·last_played는 별도 파생값이므로 함께 재계산한다.
 * @param {{ deviceId: string, from?: string | null, to?: string | null }} opts
 * @returns {{ deleted: number, affectedTracks: number }}
 */
export function deletePlaysByDevice({ deviceId, from = null, to = null }) {
  const id = normalizeDeviceId(deviceId);
  if (!id) return { deleted: 0, affectedTracks: 0 };

  const where = ['device_id = ?'];
  const params = [id];
  if (from) {
    where.push('played_at >= ?');
    params.push(from);
  }
  if (to) {
    where.push('played_at <= ?');
    params.push(to);
  }
  const whereSql = where.join(' AND ');

  const tx = db.transaction(() => {
    const trackIds = db
      .prepare(`SELECT DISTINCT track_id FROM play_history WHERE ${whereSql}`)
      .all(...params)
      .map((r) => String(r.track_id));

    const deleted = db.prepare(`DELETE FROM play_history WHERE ${whereSql}`).run(...params).changes;

    const resync = db.prepare(
      `UPDATE track_metadata
       SET play_count = (SELECT COUNT(*) FROM play_history h WHERE h.track_id = track_metadata.id),
           last_played = (SELECT MAX(h.played_at) FROM play_history h WHERE h.track_id = track_metadata.id)
       WHERE id = ?`
    );
    for (const trackId of trackIds) resync.run(trackId);

    return { deleted, affectedTracks: trackIds.length };
  });

  return tx();
}
