import { getDB } from '../db.js';

const db = getDB();

const KEY = 'playback_last_session';

/**
 * 마지막으로 관측된 재생 세션 스냅샷.
 * 세션 허브는 메모리에만 있어서 백엔드가 재시작하면 통째로 사라진다.
 * "마지막으로 본 재생: iPhone, 3시간 전"을 남기려면 이것만 따로 영속화하면 된다.
 * @typedef {{ deviceId: string, deviceName: string|null, track: object|null, isPlaying: boolean, at: number }} LastSessionSnapshot
 */

/** @param {LastSessionSnapshot} snapshot */
export function saveLastPlaybackSession(snapshot) {
  if (!snapshot?.deviceId) return;
  try {
    db.prepare(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
    ).run(KEY, JSON.stringify(snapshot));
  } catch {
    /* 통계·재생에 영향 없는 부가 정보라 실패해도 무시 */
  }
}

/** @returns {LastSessionSnapshot | null} */
export function loadLastPlaybackSession() {
  try {
    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(KEY);
    if (!row?.value) return null;
    const parsed = JSON.parse(row.value);
    return parsed && typeof parsed === 'object' && parsed.deviceId ? parsed : null;
  } catch {
    return null;
  }
}
