import test from 'node:test';
import assert from 'node:assert/strict';
import { useTempDatabase, seedTrack, silenceConsole } from './helpers/testDb.js';

// src/db.js는 import 시점에 연결을 연다 — 반드시 먼저.
const tempDb = useTempDatabase();
const restoreConsole = silenceConsole();
const { getDB, initDB } = await import('../src/db.js');
const {
  recordTrackPlayWithHistory,
  getTrackScrobbleMeta,
  markPlayHistoryScrobbled,
} = await import('../src/repositories/trackRepository.js');
initDB();
restoreConsole();

const db = getDB();

test.after(() => tempDb.cleanup());

test('50% 이상 재생이면 기록하고 실측 listened_sec을 남긴다', () => {
  const { trackId } = seedTrack(db, { durationSec: 200 });

  const result = recordTrackPlayWithHistory(trackId, 150);

  assert.equal(result.recorded, true);
  assert.equal(result.play_count, 1);
  assert.ok(result.playHistoryId != null);

  const row = db.prepare('SELECT * FROM play_history WHERE id = ?').get(result.playHistoryId);
  // 통계 집계가 전부 SUM(listened_sec) 기준이라 여기가 비면 그 재생은 차트에서 사라진다
  assert.equal(row.listened_sec, 150);
  assert.equal(row.track_id, trackId);

  const track = db.prepare('SELECT play_count, last_played FROM track_metadata WHERE id = ?').get(trackId);
  assert.equal(track.play_count, 1);
  assert.ok(track.last_played);
});

test('listened_sec은 곡 길이를 넘지 않는다 (HLS 큐 좌표 등으로 peak이 부풀 수 있음)', () => {
  const { trackId } = seedTrack(db, { durationSec: 200 });

  const result = recordTrackPlayWithHistory(trackId, 5000);

  const row = db.prepare('SELECT listened_sec FROM play_history WHERE id = ?').get(result.playHistoryId);
  assert.equal(row.listened_sec, 200);
});

test('50% 미만이면 기록하지 않는다', () => {
  const { trackId } = seedTrack(db, { durationSec: 200 });

  const result = recordTrackPlayWithHistory(trackId, 99);

  assert.equal(result.skipped, true);
  assert.equal(result.play_count, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM play_history WHERE track_id = ?').get(trackId).n, 0);
});

test('길이를 모르는 파일은 기록하지 않는다', () => {
  const { trackId } = seedTrack(db, { durationSec: 0 });

  assert.equal(recordTrackPlayWithHistory(trackId, 500).skipped, true);
});

test('없는 트랙은 notFound', () => {
  assert.equal(recordTrackPlayWithHistory('nope', 100).notFound, true);
});

test('4초 안에 들어온 같은 곡 재생은 중복으로 보고 무시한다', () => {
  const { trackId } = seedTrack(db, { durationSec: 200 });

  assert.equal(recordTrackPlayWithHistory(trackId, 150).recorded, true);
  const second = recordTrackPlayWithHistory(trackId, 150);

  assert.equal(second.skipped, true);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM play_history WHERE track_id = ?').get(trackId).n, 1);
});

test('device_id를 남기고, 없으면 NULL(기기 미상)로 둔다', () => {
  const a = seedTrack(db, { durationSec: 200 });
  const b = seedTrack(db, { durationSec: 200 });

  const withDevice = recordTrackPlayWithHistory(a.trackId, 150, 'dev-1');
  const without = recordTrackPlayWithHistory(b.trackId, 150);

  assert.equal(
    db.prepare('SELECT device_id FROM play_history WHERE id = ?').get(withDevice.playHistoryId).device_id,
    'dev-1'
  );
  assert.equal(
    db.prepare('SELECT device_id FROM play_history WHERE id = ?').get(without.playHistoryId).device_id,
    null
  );
});

test('getTrackScrobbleMeta는 유효한 SQL이고 아티스트·앨범·길이를 돌려준다', () => {
  // 회귀: `CAST(ROUND(f.duration))`가 prepare에서 throw → 재생 1회마다 프로세스 사망
  const { trackId } = seedTrack(db, {
    title: 'Scrobble Me',
    durationSec: 201.6,
    artistName: 'Some Artist',
    albumName: 'Some Album',
  });

  const meta = getTrackScrobbleMeta(trackId);

  assert.equal(meta.title, 'Scrobble Me');
  assert.equal(meta.artist, 'Some Artist');
  assert.equal(meta.album, 'Some Album');
  assert.equal(meta.duration_sec, 202);
});

test('markPlayHistoryScrobbled가 해당 행만 갱신한다', () => {
  const { trackId } = seedTrack(db, { durationSec: 200 });
  const { playHistoryId } = recordTrackPlayWithHistory(trackId, 150);

  assert.equal(markPlayHistoryScrobbled(playHistoryId, 1), 1);
  assert.equal(
    db.prepare('SELECT scrobbled FROM play_history WHERE id = ?').get(playHistoryId).scrobbled,
    1
  );
  assert.equal(markPlayHistoryScrobbled(null, 1), 0);
});
