// node --test packages/bridge/test/backpressure.test.mjs — PTY pause/resume driven by a fake socket (P1-5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Backpressure, HIGH_WATER, LOW_WATER } from '../src/backpressure.js';

const fakeWs = (bufferedAmount = 0) => ({ OPEN: 1, readyState: 1, bufferedAmount });
const tick = (ms) => new Promise((r) => setTimeout(r, ms));

function harness(client, opts = {}) {
  const calls = [];
  const bp = new Backpressure({ getClient: () => client.ws, pause: () => calls.push('pause'), resume: () => calls.push('resume'), pollMs: 5, ...opts });
  return { bp, calls };
}

test('under the high-water mark nothing happens', () => {
  const c = { ws: fakeWs(HIGH_WATER) };
  const { bp, calls } = harness(c);
  bp.check();
  bp.check();
  assert.deepEqual(calls, []);
  assert.equal(bp.paused, false);
});

test('over 4 MiB queued → pause once; drains below 1 MiB → resume once', async () => {
  const c = { ws: fakeWs(HIGH_WATER + 1) };
  const { bp, calls } = harness(c);
  bp.check();
  bp.check(); // still over: must not pause twice
  assert.deepEqual(calls, ['pause']);
  assert.equal(bp.pauses, 1);
  c.ws.bufferedAmount = LOW_WATER + 100; // draining but not enough
  await tick(20);
  assert.deepEqual(calls, ['pause']);
  c.ws.bufferedAmount = LOW_WATER - 1;
  await tick(20);
  assert.deepEqual(calls, ['pause', 'resume']);
  assert.equal(bp.paused, false);
  assert.equal(bp.timer, null, 'poll stops after resume');
});

test('the tab disappears while paused → resume (a dead socket must not wedge the shell)', async () => {
  const c = { ws: fakeWs(HIGH_WATER * 2) };
  const { bp, calls } = harness(c);
  bp.check();
  assert.deepEqual(calls, ['pause']);
  c.ws = null;
  await tick(20);
  assert.deepEqual(calls, ['pause', 'resume']);
});

test('a closing socket does not count as a client (no pause on a socket that is not OPEN)', () => {
  const c = { ws: { ...fakeWs(HIGH_WATER * 2), readyState: 2 } };
  const { bp, calls } = harness(c);
  bp.check();
  assert.deepEqual(calls, []);
});

test('reset() forgets the paused state without touching the PTY (fresh shell after respawn)', async () => {
  const c = { ws: fakeWs(HIGH_WATER * 2) };
  const { bp, calls } = harness(c);
  bp.check();
  bp.reset();
  assert.equal(bp.paused, false);
  await tick(20);
  assert.deepEqual(calls, ['pause'], 'no resume call for a PTY that no longer exists');
  bp.check(); // the new shell can be paused again
  assert.deepEqual(calls, ['pause', 'pause']);
  bp.reset();
});
