import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequestQueue } from './request-queue.ts';
import { DEFAULT_SIGN_MAP as SIGN_WORDS } from './sign-map.ts';

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

test('subscribers hear every push and every hand-over; the sign vocabulary is exactly five words', () => {
  const q = createRequestQueue();
  const heard: string[] = [];
  const off = q.subscribe((r) => heard.push(r ? `${r.via}:${r.text}` : 'taken'));
  q.push('yes', 'sign');
  q.take();
  off();
  q.push('no', 'sign');
  assert.deepEqual(heard, ['sign:yes', 'taken'], 'a take is announced too, so "N waiting" is never stale');
  assert.deepEqual(Object.keys(SIGN_WORDS).sort(), ['Closed_Fist', 'Pointing_Up', 'Thumb_Down', 'Thumb_Up', 'Victory']);
});

test('ask: a spoken answer resolves the question and is never queued; other sentences still queue', async () => {
  const q = createRequestQueue();
  const choices = [
    { id: 'c1', label: 'Hold it' },
    { id: 'c2', label: 'Show another time' },
  ];
  const p = q.ask('Hold 10:30 with Dr Lin?', choices, 5000);
  assert.equal(q.question()?.question, 'Hold 10:30 with Dr Lin?');
  q.push('is Dr Rao available Tuesday?', 'voice');
  assert.equal(q.pending(), 1, 'an unrelated sentence queues as a request');
  assert.ok(q.question() !== null, 'the question is still open');
  q.push('the first one', 'sign');
  const r = await p;
  assert.equal(r.answer?.index, 0);
  assert.equal(r.answer?.via, 'sign');
  assert.equal(r.stopped, false);
  assert.equal(q.pending(), 1, 'the answer was never queued');
  assert.equal(q.question(), null);
});

test('ask: the card button answers; stop stops; timeout and supersede resolve with no answer', async () => {
  const q = createRequestQueue();
  const choices = [
    { id: 'a', label: 'Morning' },
    { id: 'b', label: 'Afternoon' },
    { id: 'c', label: 'Evening' },
  ];
  const p1 = q.ask('When?', choices, 5000);
  assert.equal(q.answer(5), false, 'no such choice');
  assert.equal(q.answer(2), true);
  const r1 = await p1;
  assert.equal(r1.answer?.choice.label, 'Evening');
  assert.equal(r1.answer?.via, 'button');
  const p2 = q.ask('When?', choices, 5000);
  q.push('stop', 'typed');
  assert.deepEqual(await p2, { answer: null, stopped: true });
  const p3 = q.ask('When?', choices, 10);
  assert.deepEqual(await p3, { answer: null, stopped: false });
  const p4 = q.ask('When?', choices, 5000);
  const p5 = q.ask('Which?', choices, 5000);
  assert.deepEqual(await p4, { answer: null, stopped: false }, 'superseded');
  q.answer(0);
  assert.equal((await p5).answer?.index, 0);
  let notified = 0;
  q.subscribe(() => notified++);
  const p6 = q.ask('Again?', choices, 5000);
  q.answer(1);
  await p6;
  assert.ok(notified >= 2, 'the panel is told when a question opens and when it closes');
});
