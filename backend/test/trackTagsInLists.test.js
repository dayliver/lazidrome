import test from 'node:test';
import assert from 'node:assert/strict';
import { useTempDatabase, seedTrack, silenceConsole } from './helpers/testDb.js';

const tempDb = useTempDatabase();
const restoreConsole = silenceConsole();
const { getDB, initDB } = await import('../src/db.js');
initDB();
// 핸들러가 끌고 오는 저장소 중엔 모듈을 읽는 순간 문장을 준비하는 것이 있다 — 스키마를 먼저 만들어야 한다
const { getAlbumDetailHandler } = await import('../src/handlers/albums.detail.js');
const { getArtistDetailHandler } = await import('../src/handlers/artists.detail.js');
const { getPlaylistDetailHandler } = await import('../src/handlers/playlists.get.js');
restoreConsole();

const db = getDB();

test.after(() => tempDb.cleanup());

const reply = () => {
  const r = { statusCode: 200, body: null };
  r.code = (status) => { r.statusCode = status; return r; };
  r.send = (payload) => { r.body = payload; return r; };
  return r;
};

const call = (handler, params) => handler({ params, log: { error: () => {} } }, reply());

// 태그를 배열로 내려주지 않으면 화면에서 문자열을 배열처럼 다루다 기존 태그를 날린다
test('앨범·아티스트 상세의 트랙도 태그를 배열로 싣고 나간다', async () => {
  const { trackId, albumId, artistId } = seedTrack(db, {
    title: '태그 실린 곡',
    artistName: '테스트 가수',
    albumName: '테스트 앨범',
  });
  db.prepare('UPDATE track_metadata SET tags = ? WHERE id = ?').run('["봄","드라이브"]', trackId);

  const album = await call(getAlbumDetailHandler, { id: albumId });
  assert.deepEqual(album.tracks.find((t) => t.id === trackId).tags, ['봄', '드라이브']);

  const artist = await call(getArtistDetailHandler, { id: artistId });
  assert.deepEqual(artist.tracks.find((t) => t.id === trackId).tags, ['봄', '드라이브']);
});

test('재생목록 상세의 트랙도 마찬가지이고, 아티스트 이름은 그대로다', async () => {
  const { trackId } = seedTrack(db, {
    title: '재생목록 곡',
    artistName: '재생목록 가수',
  });
  db.prepare('UPDATE track_metadata SET tags = ? WHERE id = ?').run('["밤"]', trackId);

  db.prepare("INSERT INTO playlists (id, name, type) VALUES ('pl-1', '테스트', 'list')").run();
  db.prepare(
    "INSERT INTO playlist_tracks (id, playlist_id, track_id, position) VALUES ('plt-1', 'pl-1', ?, 10)"
  ).run(trackId);

  const playlist = await call(getPlaylistDetailHandler, { id: 'pl-1' });
  const row = playlist.tracks.find((t) => t.id === trackId);

  assert.deepEqual(row.tags, ['밤']);
  assert.equal(row.artist, '재생목록 가수');
  assert.equal(row.artists_json, undefined);
});

test('태그가 비었거나 망가진 행도 빈 배열로 내려간다', async () => {
  const { trackId, albumId } = seedTrack(db, { title: '태그 없는 곡', albumName: '빈 앨범' });
  db.prepare("UPDATE track_metadata SET tags = '' WHERE id = ?").run(trackId);

  const album = await call(getAlbumDetailHandler, { id: albumId });
  assert.deepEqual(album.tracks.find((t) => t.id === trackId).tags, []);
});
