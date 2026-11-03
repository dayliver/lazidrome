import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildConcatListBody,
  formatConcatFileLine,
} from '../src/lib/continuousStream.js';

test('formatConcatFileLine quotes and escapes paths', () => {
  assert.equal(formatConcatFileLine(`/music/foo.mp3`), `file '/music/foo.mp3'\n`);
  assert.equal(
    formatConcatFileLine(`/music/o'brian.flac`),
    `file '/music/o'\\''brian.flac'\n`,
  );
});

test('buildConcatListBody joins lines in order', () => {
  const body = buildConcatListBody(['/a.mp3', '/b.flac']);
  assert.equal(body, `file '/a.mp3'\nfile '/b.flac'\n`);
});
