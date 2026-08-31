// Run: node --experimental-strip-types --test src/lib/drop/board-announce.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BoardAnnouncer,
  DEFAULT_ANNOUNCE_INTERVAL_MS,
  diffAnnouncements,
  slotAnnouncement,
  transitionAnnouncement,
  waveAnnouncement,
} from './board-announce.ts';
import type { Slot, SlotState } from './types.ts';

const slot = (id: string, timeLabel: string, state: SlotState): Slot => ({
  id,
  timeLabel,
  clinician: 'Dr. Okonkwo',
  kind: 'New patient',
  state,
});

test('slotAnnouncement says the human sentence for each state; open is silent', () => {
  assert.equal(slotAnnouncement({ timeLabel: '9:20', state: 'open' }), null);
  assert.equal(slotAnnouncement({ timeLabel: '9:40', state: 'held_by_you' }), '9:40 held — yours');
  assert.equal(slotAnnouncement({ timeLabel: '9:40', state: 'held_by_other' }), '9:40 held by someone else');
  assert.equal(slotAnnouncement({ timeLabel: '9:20', state: 'taken_by_rival' }), '9:20 slot taken');
  assert.equal(slotAnnouncement({ timeLabel: '10:00', state: 'booked_yours' }), '10:00 booked — yours');
  assert.equal(slotAnnouncement({ timeLabel: '10:00', state: 'expired_hold' }), '10:00 hold expired');
  assert.equal(slotAnnouncement({ timeLabel: '   ', state: 'taken_by_rival' }), null);
});

test('transitionAnnouncement is silent on no-change and on a slot arriving open', () => {
  assert.equal(transitionAnnouncement('open', { timeLabel: '9:20', state: 'open' }), null);
  assert.equal(transitionAnnouncement(undefined, { timeLabel: '9:20', state: 'open' }), null);
  assert.equal(transitionAnnouncement('held_by_you', { timeLabel: '9:20', state: 'open' }), '9:20 open again');
  assert.equal(transitionAnnouncement('open', { timeLabel: '9:20', state: 'held_by_you' }), '9:20 held — yours');
  assert.equal(
    transitionAnnouncement(undefined, { timeLabel: '9:20', state: 'taken_by_rival' }),
    '9:20 slot taken',
  );
});

test('diffAnnouncements reports only changes, in board order', () => {
  const prev = [slot('a', '9:20', 'open'), slot('b', '9:40', 'held_by_you'), slot('c', '10:00', 'open')];
  const next = [
    slot('a', '9:20', 'taken_by_rival'),
    slot('b', '9:40', 'held_by_you'), // unchanged
    slot('c', '10:00', 'booked_yours'),
  ];
  assert.deepEqual(diffAnnouncements(prev, next), ['9:20 slot taken', '10:00 booked — yours']);
});

test('diffAnnouncements stays quiet for a fresh wave of open slots, and for vanished slots', () => {
  const wave = [slot('a', '9:20', 'open'), slot('b', '9:40', 'open')];
  assert.deepEqual(diffAnnouncements([], wave), []);
  assert.deepEqual(diffAnnouncements(wave, [slot('a', '9:20', 'open')]), []);
});

test('waveAnnouncement counts honestly and pluralises', () => {
  assert.equal(waveAnnouncement([]), null);
  assert.equal(waveAnnouncement([slot('a', '9:20', 'open')]), '1 slot just opened');
  assert.equal(
    waveAnnouncement([slot('a', '9:20', 'open'), slot('b', '9:40', 'open')]),
    '2 slots just opened',
  );
});

test('the queue releases at most one line per interval', () => {
  const a = new BoardAnnouncer({ intervalMs: 1000 });
  a.pushAll(['9:20 slot taken', '9:40 held — yours']);
  assert.equal(a.pending, 2);

  assert.equal(a.read(0), '9:20 slot taken'); // first read releases immediately
  assert.equal(a.read(0), '9:20 slot taken'); // idempotent inside the interval
  assert.equal(a.read(999), '9:20 slot taken');
  assert.equal(a.pending, 1);

  assert.equal(a.read(1000), '9:40 held — yours');
  assert.equal(a.pending, 0);
  assert.equal(a.read(9999), '9:40 held — yours'); // nothing queued: the line stands
});

test('the queue ignores empty lines and an immediate repeat', () => {
  const a = new BoardAnnouncer({ intervalMs: 10 });
  a.push('9:20 slot taken');
  a.push('9:20 slot taken'); // repeat of what is queued
  a.push('');
  a.push('   ');
  a.push(null);
  a.push(undefined);
  assert.equal(a.pending, 1);

  assert.equal(a.read(0), '9:20 slot taken');
  a.push('9:20 slot taken'); // repeat of what is on screen
  assert.equal(a.pending, 0);
  a.push('9:40 held — yours');
  assert.equal(a.pending, 1);
});

test('a burst overflows the stalest lines, not the newest', () => {
  const a = new BoardAnnouncer({ intervalMs: 1000, maxQueue: 2 });
  a.pushAll(['first', 'second', 'third', 'fourth']);
  assert.equal(a.pending, 2);
  assert.equal(a.dropped, 2);
  assert.equal(a.read(0), 'third');
  assert.equal(a.read(1000), 'fourth');
});

test('flush says the rest as one line and resets the clock', () => {
  const a = new BoardAnnouncer({ intervalMs: 1000 });
  a.pushAll(['9:20 slot taken', '9:40 held — yours']);
  assert.equal(a.flush(0), '9:20 slot taken. 9:40 held — yours');
  assert.equal(a.pending, 0);
  assert.equal(a.flush(50), '9:20 slot taken. 9:40 held — yours'); // nothing queued: unchanged
});

test('reset returns to silence and lets the next read fire at once', () => {
  const a = new BoardAnnouncer({ intervalMs: 1000, maxQueue: 1 });
  a.pushAll(['one', 'two']);
  a.read(0);
  a.reset();
  assert.equal(a.current, '');
  assert.equal(a.pending, 0);
  assert.equal(a.dropped, 0);
  a.push('three');
  assert.equal(a.read(0), 'three');
});

test('options are clamped to sane values and defaults are the documented ones', () => {
  const d = new BoardAnnouncer();
  assert.equal(d.intervalMs, DEFAULT_ANNOUNCE_INTERVAL_MS);
  assert.equal(d.maxQueue, 3);

  const clamped = new BoardAnnouncer({ intervalMs: -5, maxQueue: 0 });
  assert.equal(clamped.intervalMs, 0);
  assert.equal(clamped.maxQueue, 1);
  clamped.pushAll(['a', 'b']);
  assert.equal(clamped.read(0), 'b'); // interval 0: every read may release
});

test('the whole path: a wave, a loss, a hold — three lines, one per interval', () => {
  const before = [slot('a', '9:20', 'open'), slot('b', '9:40', 'open'), slot('c', '10:00', 'open')];
  const after = [
    slot('a', '9:20', 'taken_by_rival'),
    slot('b', '9:40', 'held_by_you'),
    slot('c', '10:00', 'held_by_other'),
  ];
  const a = new BoardAnnouncer({ intervalMs: 900 });
  a.pushAll(diffAnnouncements(before, after));

  assert.equal(a.read(0), '9:20 slot taken');
  assert.equal(a.read(900), '9:40 held — yours');
  assert.equal(a.read(1800), '10:00 held by someone else');
  assert.equal(a.dropped, 0);
});
