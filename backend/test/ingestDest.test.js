import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lazi-ingest-'));
const tracks = path.join(dir, 'tracks');
fs.mkdirSync(tracks);
process.env.TRACKS_PATH = tracks;

const { resolveLibraryAudioDest, noteIngestedPaths } = await import('../src/lib/ingestDest.js');
const { shouldSkipRecentScan } = await import('../src/lib/recentIngestPaths.js');

test.after(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.TRACKS_PATH;
});

test('resolveLibraryAudioDest uses Artist/Album/Artist - Album - Title layout', () => {
  const dest = resolveLibraryAudioDest({
    artist: 'Artist',
    album: 'Album',
    title: 'Song',
    ext: '.mp3',
  });
  assert.equal(
    path.relative(tracks, dest),
    path.join('Artist', 'Album', 'Artist - Album - Song.mp3'),
  );
  assert.ok(fs.existsSync(path.dirname(dest)));
});

test('resolveLibraryAudioDest adds (2) when the file already exists', () => {
  const first = resolveLibraryAudioDest({
    artist: 'A',
    album: 'B',
    title: 'T',
    ext: '.mp3',
  });
  fs.writeFileSync(first, 'x');
  const second = resolveLibraryAudioDest({
    artist: 'A',
    album: 'B',
    title: 'T',
    ext: '.mp3',
  });
  assert.match(path.basename(second), /T \(2\)\.mp3$/);
});

test('noteIngestedPaths marks paths for scan skip', () => {
  const p = path.join(tracks, 'skip-me.mp3');
  fs.writeFileSync(p, 'x');
  noteIngestedPaths(p);
  assert.equal(shouldSkipRecentScan(p), true);
});
