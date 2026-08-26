import test from 'node:test';
import assert from 'node:assert/strict';
import { useTempDatabase, seedTrack, silenceConsole } from './helpers/testDb.js';

const tempDb = useTempDatabase();
const restoreConsole = silenceConsole();
const { getDB, initDB } = await import('../src/db.js');
const { bulkUpdateTrackTags } = await import('../src/repositories/trackRepository.js');
const { patchTracksTagsBulkHandler } = await import('../src/handlers/tracks.tags.bulk.js');
initDB();
restoreConsole();

const db = getDB();

test.after(() => tempDb.cleanup());

const setTags = (trackId, tags) =>
  db.prepare('UPDATE track_metadata SET tags = ? WHERE id = ?').run(JSON.stringify(tags), trackId);

const readTags = (trackId) =>
  JSON.parse(db.prepare('SELECT tags FROM track_metadata WHERE id = ?').get(trackId).tags || '[]');

test('곡마다 다른 기존 태그를 덮어쓰지 않고 넣기·빼기만 적용한다', () => {
  const { trackId: a } = seedTrack(db, { title: 'A' });
  const { trackId: b } = seedTrack(db, { title: 'B' });
  setTags(a, ['재즈', '밤']);
  setTags(b, ['록']);

  const changed = bulkUpdateTrackTags([a, b], { add: ['드라이브'], remove: ['밤'] });

  assert.deepEqual(readTags(a), ['재즈', '드라이브']);
  assert.deepEqual(readTags(b), ['록', '드라이브']);
  assert.equal(changed.length, 2);
  assert.deepEqual(changed.find((row) => row.id === a).tags, ['재즈', '드라이브']);
});

test('이미 그 상태인 곡은 바뀐 목록에서 빠진다', () => {
  // 화면이 돌려받은 만큼만 갱신하므로, 손대지 않은 곡이 섞이면 안 된다
  const { trackId: a } = seedTrack(db, { title: 'C' });
  const { trackId: b } = seedTrack(db, { title: 'D' });
  setTags(a, ['봄']);
  setTags(b, []);

  const changed = bulkUpdateTrackTags([a, b], { add: ['봄'] });

  assert.deepEqual(changed.map((row) => row.id), [b]);
  assert.deepEqual(readTags(a), ['봄']);
  assert.deepEqual(readTags(b), ['봄']);
});

test('태그가 없거나 망가진 곡도 새 배열로 되살린다', () => {
  const { trackId: nullTags } = seedTrack(db, { title: 'E' });
  const { trackId: broken } = seedTrack(db, { title: 'F' });
  db.prepare('UPDATE track_metadata SET tags = NULL WHERE id = ?').run(nullTags);
  db.prepare("UPDATE track_metadata SET tags = 'not json' WHERE id = ?").run(broken);

  bulkUpdateTrackTags([nullTags, broken], { add: ['새벽'] });

  assert.deepEqual(readTags(nullTags), ['새벽']);
  assert.deepEqual(readTags(broken), ['새벽']);
});

test('중복 태그를 두 번 넣지 않고, 없는 곡 id는 그냥 건너뛴다', () => {
  const { trackId } = seedTrack(db, { title: 'G' });
  setTags(trackId, ['여름']);

  const changed = bulkUpdateTrackTags([trackId, 'no-such-track'], { add: ['여름', '여름', '겨울'] });

  assert.deepEqual(readTags(trackId), ['여름', '겨울']);
  assert.equal(changed.length, 1);
});

/** 핸들러만 떼어 부르기 위한 최소한의 fastify reply 흉내 */
function fakeReply() {
  const reply = { statusCode: 200, body: null };
  reply.code = (status) => {
    reply.statusCode = status;
    return reply;
  };
  reply.send = (payload) => {
    reply.body = payload;
    return reply;
  };
  return reply;
}

const callHandler = async (body) => {
  const reply = fakeReply();
  const result = await patchTracksTagsBulkHandler(
    { body, log: { error: () => {} } },
    reply
  );
  return { reply, result };
};

test('빈 요청·변경 없는 요청은 400으로 돌려보낸다', async () => {
  const { trackId } = seedTrack(db, { title: 'H' });

  assert.equal((await callHandler({})).reply.statusCode, 400);
  assert.equal((await callHandler({ trackIds: [] })).reply.statusCode, 400);
  // 공백뿐인 태그는 정리 과정에서 사라지므로 결국 변경이 없다
  assert.equal((await callHandler({ trackIds: [trackId], add: ['  '] })).reply.statusCode, 400);
});

test('같은 태그가 넣기·빼기에 함께 오면 넣기가 이긴다', async () => {
  const { trackId } = seedTrack(db, { title: 'I' });

  const { result } = await callHandler({ trackIds: [trackId], add: ['가을'], remove: ['가을'] });

  assert.equal(result.updated, 1);
  assert.deepEqual(readTags(trackId), ['가을']);
});

test('태그 이름의 앞뒤 공백은 털어내고 저장한다', async () => {
  const { trackId } = seedTrack(db, { title: 'J' });

  await callHandler({ trackIds: [trackId], add: ['  비 오는 날  '] });

  assert.deepEqual(readTags(trackId), ['비 오는 날']);
});
