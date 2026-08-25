import test from 'node:test';
import assert from 'node:assert/strict';
import { useTempDatabase, seedTrack, insertPlay, silenceConsole } from './helpers/testDb.js';

const tempDb = useTempDatabase();
const restoreConsole = silenceConsole();
const { getDB, initDB } = await import('../src/db.js');
const {
  touchDevice,
  listDevices,
  findDevice,
  renameDevice,
  setDeviceExcludeFromStats,
  deleteDevice,
  listExcludedDeviceIds,
  deletePlaysByDevice,
  normalizeDeviceId,
} = await import('../src/repositories/deviceRepository.js');
initDB();
restoreConsole();

const db = getDB();

test.after(() => tempDb.cleanup());

test('touchDevice는 최초 1회만 이름을 쓰고 이후엔 덮어쓰지 않는다', () => {
  // 사용자가 붙인 이름을 UA 추정 이름이 다시 밀어버리면 안 된다
  touchDevice('d-name', 'Android');
  renameDevice('d-name', '내 폰');
  touchDevice('d-name', 'Android');

  assert.equal(findDevice('d-name').name, '내 폰');
});

test('빈 device id는 무시한다', () => {
  assert.equal(touchDevice('', 'X'), null);
  assert.equal(touchDevice(null, 'X'), null);
  assert.equal(normalizeDeviceId('  '), null);
  assert.equal(normalizeDeviceId(' abc '), 'abc');
});

test('exclude_from_stats 토글과 목록 조회', () => {
  touchDevice('d-ex', 'Speaker');

  assert.deepEqual(listExcludedDeviceIds(), []);
  setDeviceExcludeFromStats('d-ex', true);
  assert.deepEqual(listExcludedDeviceIds(), ['d-ex']);
  assert.equal(findDevice('d-ex').exclude_from_stats, true);

  setDeviceExcludeFromStats('d-ex', false);
  assert.deepEqual(listExcludedDeviceIds(), []);
});

test('listDevices는 재생 수와 마지막 재생을 함께 준다', () => {
  const deviceId = touchDevice('d-plays', 'Counter');
  const { trackId } = seedTrack(db, { durationSec: 200 });
  insertPlay(db, { trackId, playedAt: '2026-08-01 10:00:00', listenedSec: 200, deviceId });
  insertPlay(db, { trackId, playedAt: '2026-08-02 10:00:00', listenedSec: 200, deviceId });

  const row = listDevices().find((d) => d.id === deviceId);

  assert.equal(row.play_count, 2);
  assert.equal(row.last_played_at, '2026-08-02 10:00:00');
});

test('기기를 삭제해도 재생 기록은 기기 미상으로 남는다', () => {
  const deviceId = touchDevice('d-gone', 'Doomed');
  const { trackId } = seedTrack(db, { durationSec: 200 });
  insertPlay(db, { trackId, playedAt: '2026-08-01 10:00:00', listenedSec: 200, deviceId });

  assert.equal(deleteDevice(deviceId), 1);
  assert.equal(findDevice(deviceId), null);
  // 소프트 참조라 기록은 보존된다
  assert.equal(
    db.prepare('SELECT COUNT(*) AS n FROM play_history WHERE device_id = ?').get(deviceId).n,
    1
  );
});

test('기간 지정 purge는 그 범위만 지우고 play_count를 다시 계산한다', () => {
  const deviceId = touchDevice('d-purge', 'Purger');
  const { trackId } = seedTrack(db, { durationSec: 200 });
  insertPlay(db, { trackId, playedAt: '2026-07-01 10:00:00', listenedSec: 200, deviceId });
  insertPlay(db, { trackId, playedAt: '2026-08-10 10:00:00', listenedSec: 200, deviceId });
  insertPlay(db, { trackId, playedAt: '2026-08-11 10:00:00', listenedSec: 200, deviceId });
  db.prepare('UPDATE track_metadata SET play_count = 3 WHERE id = ?').run(trackId);

  const result = deletePlaysByDevice({
    deviceId,
    from: '2026-08-01 00:00:00',
    to: '2026-08-31 23:59:59',
  });

  assert.equal(result.deleted, 2);
  assert.equal(result.affectedTracks, 1);
  assert.equal(
    db.prepare('SELECT COUNT(*) AS n FROM play_history WHERE device_id = ?').get(deviceId).n,
    1
  );
  // 파생값이 남아 있으면 트랙 목록 정렬이 계속 틀어진다
  assert.equal(db.prepare('SELECT play_count FROM track_metadata WHERE id = ?').get(trackId).play_count, 1);
});

test('기간 없이 purge하면 그 기기 기록을 전부 지운다', () => {
  const deviceId = touchDevice('d-purge-all', 'Purger2');
  const other = touchDevice('d-keep', 'Keeper');
  const { trackId } = seedTrack(db, { durationSec: 200 });
  insertPlay(db, { trackId, playedAt: '2026-08-10 10:00:00', listenedSec: 200, deviceId });
  insertPlay(db, { trackId, playedAt: '2026-08-11 10:00:00', listenedSec: 200, deviceId });
  insertPlay(db, { trackId, playedAt: '2026-08-12 10:00:00', listenedSec: 200, deviceId: other });

  const result = deletePlaysByDevice({ deviceId });

  assert.equal(result.deleted, 2);
  // 다른 기기 기록은 건드리지 않는다
  assert.equal(
    db.prepare('SELECT COUNT(*) AS n FROM play_history WHERE device_id = ?').get(other).n,
    1
  );
  assert.equal(db.prepare('SELECT play_count FROM track_metadata WHERE id = ?').get(trackId).play_count, 1);
});

test('없는 기기 purge는 아무 것도 지우지 않는다', () => {
  assert.deepEqual(deletePlaysByDevice({ deviceId: '' }), { deleted: 0, affectedTracks: 0 });
});
