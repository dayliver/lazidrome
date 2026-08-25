import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { useTempDatabase, seedTrack, silenceConsole } from './helpers/testDb.js';

const tempDb = useTempDatabase();

// 이미지 핸들러는 모듈 로드 시점에 IMAGES_PATH를 읽는다
const imagesDir = path.join(tempDb.dir, 'images');
fs.mkdirSync(imagesDir, { recursive: true });
process.env.IMAGES_PATH = imagesDir;

const restoreConsole = silenceConsole();
const { getDB, initDB } = await import('../src/db.js');
const { getTrackImageHandler } = await import('../src/handlers/images.get.js');
initDB();
restoreConsole();

const db = getDB();
const { trackId } = seedTrack(db, { title: 'Covered' });

// 커스텀 커버가 있는 것처럼 파일과 DB 값을 맞춰 둔다 (imageService는 tracks/<id><ext>를 찾는다)
fs.mkdirSync(path.join(imagesDir, 'tracks'), { recursive: true });
const coverName = path.join('tracks', `${trackId}.jpg`);
fs.writeFileSync(path.join(imagesDir, coverName), Buffer.alloc(2048, 7));
db.prepare("UPDATE track_metadata SET custom_cover_type = '.jpg' WHERE id = ?").run(trackId);

const app = Fastify();
app.register(fastifyStatic, { root: imagesDir, decorateReply: true });
app.get('/api/images/track/:id', getTrackImageHandler);
await app.ready();

test.after(async () => {
  await app.close();
  delete process.env.IMAGES_PATH;
  tempDb.cleanup();
});

const URL = `/api/images/track/${trackId}`;

test('커버는 서명 기반 private 캐시와 강한 ETag로 나간다', async () => {
  // 회귀: reply.sendFile이 자기 `public, max-age=0`과 약한 ETag를 덧씌워
  //       커버가 브라우저에 전혀 캐시되지 않던 문제
  const res = await app.inject({ method: 'GET', url: URL });

  assert.equal(res.statusCode, 200);
  assert.match(res.headers['cache-control'], /^private, max-age=\d+$/);
  assert.doesNotMatch(res.headers['cache-control'], /public/);

  const etag = res.headers.etag;
  assert.ok(etag, 'ETag가 있어야 한다');
  assert.doesNotMatch(etag, /^W\//, '약한 ETag면 우리 조건부 매칭이 깨진다');
});

test('같은 ETag로 다시 요청하면 304를 준다', async () => {
  const first = await app.inject({ method: 'GET', url: URL });
  const etag = first.headers.etag;

  const second = await app.inject({
    method: 'GET',
    url: URL,
    headers: { 'if-none-match': etag },
  });

  assert.equal(second.statusCode, 304);
  assert.equal(second.headers.etag, etag);
  assert.match(second.headers['cache-control'], /^private, max-age=\d+$/);
});

test('ETag가 다르면 본문을 다시 보낸다', async () => {
  const res = await app.inject({
    method: 'GET',
    url: URL,
    headers: { 'if-none-match': '"stale-etag"' },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.rawPayload.length, 2048);
});

test('파일이 바뀌면 ETag도 바뀐다', async () => {
  const before = (await app.inject({ method: 'GET', url: URL })).headers.etag;

  fs.writeFileSync(path.join(imagesDir, coverName), Buffer.alloc(4096, 9));
  const after = (await app.inject({ method: 'GET', url: URL })).headers.etag;

  assert.notEqual(before, after);
});
