import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { useTempDatabase, seedTrack, silenceConsole } from './helpers/testDb.js';

const tempDb = useTempDatabase();
const restoreConsole = silenceConsole();

const imagesDir = path.join(tempDb.dir, 'images');
const tracksDir = path.join(tempDb.dir, 'tracks');
fs.mkdirSync(path.join(imagesDir, 'tracks'), { recursive: true });
fs.mkdirSync(tracksDir, { recursive: true });
process.env.IMAGES_PATH = imagesDir;
process.env.TRACKS_PATH = tracksDir;

const { getDB, initDB } = await import('../src/db.js');
initDB();
const { deleteTrack } = await import('../src/services/trackDeleteService.js');
restoreConsole();

const db = getDB();

test.after(() => tempDb.cleanup());

test('트랙 삭제 시 DB·오디오·커스텀 커버를 제거하고 빈 앨범을 정리한다', () => {
  const { trackId, fileId, albumId } = seedTrack(db, {
    title: 'Delete Me',
    albumName: 'Lonely Album',
    artistName: 'Solo Artist',
  });

  const audioPath = path.join(tracksDir, `${fileId}.mp3`);
  fs.writeFileSync(audioPath, Buffer.from('fake-audio'));
  db.prepare('UPDATE track_filedata SET path = ? WHERE id = ?').run(audioPath, fileId);

  const coverPath = path.join(imagesDir, 'tracks', `${trackId}.jpg`);
  fs.writeFileSync(coverPath, Buffer.from('fake-cover'));
  db.prepare("UPDATE track_metadata SET custom_cover_type = '.jpg' WHERE id = ?").run(trackId);

  const result = deleteTrack(trackId);

  assert.equal(result.deleted, true);
  assert.equal(result.id, trackId);
  assert.equal(db.prepare('SELECT id FROM track_metadata WHERE id = ?').get(trackId), undefined);
  assert.equal(db.prepare('SELECT id FROM track_filedata WHERE id = ?').get(fileId), undefined);
  assert.equal(db.prepare('SELECT id FROM albums WHERE id = ?').get(albumId), undefined);
  assert.equal(fs.existsSync(audioPath), false);
  assert.equal(fs.existsSync(coverPath), false);
});

test('없는 트랙 삭제는 404를 낸다', () => {
  assert.throws(
    () => deleteTrack('no-such-track'),
    (err) => err?.statusCode === 404,
  );
});
