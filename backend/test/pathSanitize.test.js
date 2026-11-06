import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertInsideTracksRoot } from '../src/lib/pathSanitize.js';

test('심볼릭 링크로 같은 폴더면 라이브러리 안의 파일로 본다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lazi-path-'));
  try {
    const realMusic = path.join(dir, 'music');
    const project = path.join(dir, 'project');
    fs.mkdirSync(realMusic);
    fs.mkdirSync(project);
    const tracksLink = path.join(project, 'tracks');
    fs.symlinkSync(realMusic, tracksLink);

    const file = path.join(tracksLink, 'Artist', 'song.m4a');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, 'x');

    const result = assertInsideTracksRoot(tracksLink, file);
    assert.equal(result, path.resolve(file));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('라이브러리 밖 경로는 거부한다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lazi-path-'));
  try {
    const tracks = path.join(dir, 'tracks');
    const outside = path.join(dir, 'outside.mp3');
    fs.mkdirSync(tracks);
    fs.writeFileSync(outside, 'x');
    assert.throws(
      () => assertInsideTracksRoot(tracks, outside),
      /escapes tracks root/,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
