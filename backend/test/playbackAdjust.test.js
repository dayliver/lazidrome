import test from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizePlaybackRate,
  nudgePlaybackRate,
  shouldJumpLoopRegion,
  isValidLoopRegion,
  PLAYBACK_RATE_MIN,
  PLAYBACK_RATE_MAX,
} from '../../frontend/src/lib/playbackAdjust.js'

test('normalizePlaybackRate clamps and rounds to 0.1', () => {
  assert.equal(normalizePlaybackRate(1), 1)
  assert.equal(normalizePlaybackRate(1.04), 1)
  assert.equal(normalizePlaybackRate(1.05), 1.1)
  assert.equal(normalizePlaybackRate(2.5), PLAYBACK_RATE_MAX)
  assert.equal(normalizePlaybackRate(0.2), PLAYBACK_RATE_MIN)
  assert.equal(normalizePlaybackRate('nope'), 1)
})

test('nudgePlaybackRate steps by 0.1 within bounds', () => {
  assert.equal(nudgePlaybackRate(1, 0.1), 1.1)
  assert.equal(nudgePlaybackRate(1, -0.1), 0.9)
  assert.equal(nudgePlaybackRate(PLAYBACK_RATE_MAX, 0.1), PLAYBACK_RATE_MAX)
  assert.equal(nudgePlaybackRate(PLAYBACK_RATE_MIN, -0.1), PLAYBACK_RATE_MIN)
})

test('shouldJumpLoopRegion near loop end', () => {
  assert.equal(shouldJumpLoopRegion(9.5, 10), false)
  assert.equal(shouldJumpLoopRegion(9.95, 10), true)
})

test('isValidLoopRegion minimum length', () => {
  assert.equal(isValidLoopRegion(0, 0.4), false)
  assert.equal(isValidLoopRegion(0, 0.5), true)
  assert.equal(isValidLoopRegion(2, 10), true)
})
