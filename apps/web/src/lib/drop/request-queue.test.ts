import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequestQueue, SIGN_WORDS } from './request-queue.ts';

test('push then take: oldest first, trimmed, empty ignored', () => {
  const q = createRequestQueue();
  assert.equal(q.push('   ', 'typed'), null);
  q.push('  hold me   the earliest ', 'voice', 1);
  q.push('yes', 'sign', 2);
  assert.equal(q.pending(), 2);
  assert.deepEqual(q.take(), { at: 1, text: 'hold me the earliest', via: 'voice' });
  assert.deepEqual(q.take(), { at: 2, text: 'yes', via: 'sign' });
  assert.equal(q.take(), null);
  assert.equal(q.history().length, 2, 'history keeps what was taken');
});

test('wait resolves with a request pushed later, and with null on timeout', async () => {
  const q = createRequestQueue();
  const p = q.wait(5000);
  q.push('cancel it', 'voice', 7);
  assert.deepEqual(await p, { at: 7, text: 'cancel it', via: 'voice' });
  assert.equal(q.pending(), 0, 'handed straight to the waiter, never queued');
  assert.equal(await q.wait(10), null);
});

test('wait honours an AbortSignal and leaves the queue clean', async () => {
  const q = createRequestQueue();
  const ac = new AbortController();
  const p = q.wait(60_000, ac.signal);
  ac.abort();
  assert.equal(await p, null);
  q.push('after the abort', 'typed');
  assert.equal(q.pending(), 1, 'a request after the abort waits for the next caller');
});

test('subscribers hear every push; the sign vocabulary is exactly five words', () => {
  const q = createRequestQueue();
  const heard: string[] = [];
  const off = q.subscribe((r) => heard.push(`${r.via}:${r.text}`));
  q.push('yes', 'sign');
  off();
  q.push('no', 'sign');
  assert.deepEqual(heard, ['sign:yes']);
  assert.deepEqual(Object.keys(SIGN_WORDS).sort(), ['Closed_Fist', 'Pointing_Up', 'Thumb_Down', 'Thumb_Up', 'Victory']);
});
