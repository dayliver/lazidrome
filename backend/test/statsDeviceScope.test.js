import test from 'node:test';
import assert from 'node:assert/strict';
import { useTempDatabase, seedTrack, insertPlay, silenceConsole } from './helpers/testDb.js';

const tempDb = useTempDatabase();
const restoreConsole = silenceConsole();
const { getDB, initDB } = await import('../src/db.js');
const { getStatsTopPayload, getPlayStatsPayload, getHabitStatsPayload } = await import(
  '../src/repositories/statsRepository.js'
);
const { touchDevice, setDeviceExcludeFromStats } = await import(
  '../src/repositories/deviceRepository.js'
);
initDB();
restoreConsole();

const db = getDB();

/** played_at은 UTC 문자열로 저장된다 — 기간 안에 확실히 들어오도록 방금 시각으로 */
function minutesAgo(mins) {
  return new Date(Date.now() - mins * 60_000).toISOString().replace('T', ' ').slice(0, 19);
}

const pc = touchDevice('t-pc', 'PC');
const speaker = touchDevice('t-speaker', 'Speaker');

const pcTrack = seedTrack(db, { title: 'PC Song', durationSec: 200, artistName: 'PC Artist' });
const spkTrack = seedTrack(db, { title: 'Speaker Song', durationSec: 300, artistName: 'Spk Artist' });
const oldTrack = seedTrack(db, { title: 'Legacy Song', durationSec: 100, artistName: 'Old Artist' });

insertPlay(db, { trackId: pcTrack.trackId, playedAt: minutesAgo(10), listenedSec: 200, deviceId: pc });
insertPlay(db, { trackId: spkTrack.trackId, playedAt: minutesAgo(20), listenedSec: 300, deviceId: speaker });
// 기기 귀속 이전에 쌓인 기록
insertPlay(db, { trackId: oldTrack.trackId, playedAt: minutesAgo(30), listenedSec: 100, deviceId: null });

test.after(() => tempDb.cleanup());

const titles = (payload) => payload.tracks.map((t) => t.title).sort();

test('스코프 없으면 기기 미상 포함 전부 집계한다', () => {
  const payload = getStatsTopPayload('7d', 10, 'UTC');

  assert.deepEqual(titles(payload), ['Legacy Song', 'PC Song', 'Speaker Song']);
  assert.equal(payload.totals.totalPlays, 3);
  assert.equal(payload.totals.totalListenSec, 600);
});

test('특정 기기를 고르면 그 기기만 본다', () => {
  const payload = getStatsTopPayload('7d', 10, 'UTC', { deviceId: pc });

  assert.deepEqual(titles(payload), ['PC Song']);
  assert.equal(payload.totals.totalListenSec, 200);
  assert.equal(payload.deviceId, pc);
});

test('exclude_from_stats 기기는 전체 집계에서 빠지되 기기 미상은 남는다', () => {
  setDeviceExcludeFromStats(speaker, true);

  const payload = getStatsTopPayload('7d', 10, 'UTC');

  assert.deepEqual(titles(payload), ['Legacy Song', 'PC Song']);
  assert.equal(payload.totals.totalPlays, 2);
  assert.equal(payload.totals.totalListenSec, 300);
});

test('제외된 기기도 명시적으로 고르면 보인다', () => {
  const payload = getStatsTopPayload('7d', 10, 'UTC', { deviceId: speaker });

  assert.deepEqual(titles(payload), ['Speaker Song']);
});

test('plays 시리즈와 habits도 같은 제외 규칙을 따른다', () => {
  const plays = getPlayStatsPayload('7d');
  const total = plays.series.reduce((sum, p) => sum + p.count, 0);
  assert.equal(total, 2);

  const habits = getHabitStatsPayload('7d', 'UTC');
  assert.equal(habits.totalListenSec, 300);

  // 스코프를 주면 그 기기만
  assert.equal(getHabitStatsPayload('7d', 'UTC', speaker).totalListenSec, 300);
  assert.equal(getHabitStatsPayload('7d', 'UTC', pc).totalListenSec, 200);
});

test('제외를 풀면 다시 집계된다', () => {
  setDeviceExcludeFromStats(speaker, false);

  assert.equal(getStatsTopPayload('7d', 10, 'UTC').totals.totalPlays, 3);
});

test('기간 밖 재생은 빠진다', () => {
  const { trackId } = seedTrack(db, { title: 'Ancient', durationSec: 100 });
  insertPlay(db, { trackId, playedAt: '2020-01-01 00:00:00', listenedSec: 100, deviceId: pc });

  assert.ok(!titles(getStatsTopPayload('7d', 10, 'UTC')).includes('Ancient'));
  assert.ok(titles(getStatsTopPayload('all', 10, 'UTC')).includes('Ancient'));
});
