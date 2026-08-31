// Run: node --experimental-strip-types --test src/lib/drop/confirm-logic.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ANNOUNCE_MARKS,
  announcementFor,
  blockedAnnouncement,
  crossedMark,
  decideConfirm,
  isConfirmKey,
  secondsPhrase,
  surfaceCopy,
  surfaceUrgency,
  type ConfirmAttempt,
} from './confirm-logic.ts';

const armed = (over: Partial<ConfirmAttempt> = {}): ConfirmAttempt => ({
  isTrusted: true,
  source: 'key',
  key: 'Enter',
  disabled: false,
  secondsLeft: 20,
  alreadyConfirmed: false,
  ...over,
});

// --- the load-bearing rule -------------------------------------------------

test('a trusted Enter, Space or Spacebar keypress confirms', () => {
  for (const key of ['Enter', ' ', 'Spacebar']) {
    assert.deepEqual(decideConfirm(armed({ key })), { kind: 'confirm' }, key);
  }
});

test('a trusted pointer press confirms without a key', () => {
  assert.deepEqual(decideConfirm(armed({ source: 'pointer', key: undefined })), { kind: 'confirm' });
});

test('an untrusted press never confirms and is always counted as blocked', () => {
  assert.deepEqual(decideConfirm(armed({ isTrusted: false })), { kind: 'blocked', reason: 'untrusted' });
  assert.deepEqual(decideConfirm(armed({ isTrusted: undefined })), { kind: 'blocked', reason: 'untrusted' });
  assert.deepEqual(decideConfirm(armed({ source: 'pointer', key: undefined, isTrusted: false })), {
    kind: 'blocked',
    reason: 'untrusted',
  });
});

test('untrust is decided before disabled/expired, so the counter sees every synthetic press', () => {
  assert.deepEqual(decideConfirm(armed({ isTrusted: false, disabled: true })), { kind: 'blocked', reason: 'untrusted' });
  assert.deepEqual(decideConfirm(armed({ isTrusted: false, secondsLeft: 0 })), { kind: 'blocked', reason: 'untrusted' });
  assert.deepEqual(decideConfirm(armed({ isTrusted: false, alreadyConfirmed: true })), {
    kind: 'blocked',
    reason: 'untrusted',
  });
});

test('a non-confirm key is not an attempt at all, trusted or not', () => {
  assert.deepEqual(decideConfirm(armed({ key: 'a' })), { kind: 'ignore', reason: 'other-key' });
  assert.deepEqual(decideConfirm(armed({ key: 'Tab', isTrusted: false })), { kind: 'ignore', reason: 'other-key' });
  assert.deepEqual(decideConfirm(armed({ key: undefined })), { kind: 'ignore', reason: 'other-key' });
});

test('key repeat does not re-fire; holding Enter books once', () => {
  assert.deepEqual(decideConfirm(armed({ repeat: true })), { kind: 'ignore', reason: 'repeat' });
  assert.deepEqual(decideConfirm(armed({ repeat: false })), { kind: 'confirm' });
});

test('nothing held, run out, or already booked: trusted presses are ignored in that order', () => {
  assert.deepEqual(decideConfirm(armed({ disabled: true })), { kind: 'ignore', reason: 'disabled' });
  assert.deepEqual(decideConfirm(armed({ secondsLeft: 0 })), { kind: 'ignore', reason: 'expired' });
  assert.deepEqual(decideConfirm(armed({ secondsLeft: -3 })), { kind: 'ignore', reason: 'expired' });
  assert.deepEqual(decideConfirm(armed({ alreadyConfirmed: true })), { kind: 'ignore', reason: 'already-confirmed' });
});

test('isConfirmKey covers switch-access Space spellings only', () => {
  assert.equal(isConfirmKey('Enter'), true);
  assert.equal(isConfirmKey(' '), true);
  assert.equal(isConfirmKey('Spacebar'), true);
  assert.equal(isConfirmKey('space'), false);
  assert.equal(isConfirmKey(undefined), false);
});

// --- announcements ---------------------------------------------------------

const st = (armedNow: boolean, secondsLeft: number, slotLabel = '9:20 AM with Dr. Okonjo') => ({
  armed: armedNow,
  secondsLeft,
  slotLabel,
});

test('arming announces the slot, the time left and the verb', () => {
  assert.equal(
    announcementFor(st(true, 45), st(false, 0)),
    'Slot held: 9:20 AM with Dr. Okonjo. 45 seconds. Press Enter to book.',
  );
  assert.equal(announcementFor(st(true, 45), null), 'Slot held: 9:20 AM with Dr. Okonjo. 45 seconds. Press Enter to book.');
});

test('ordinary ticks say nothing — the region is silent between events', () => {
  for (const [prev, next] of [
    [44, 43],
    [40, 39],
    [31, 31],
    [12, 11],
    [9, 8],
    [2, 1],
  ] as const) {
    assert.equal(announcementFor(st(true, next), st(true, prev)), null, `${prev}->${next}`);
  }
});

test('each mark announces exactly once, on the way down', () => {
  assert.equal(announcementFor(st(true, 30), st(true, 31)), '30 seconds left. Press Enter to book.');
  assert.equal(announcementFor(st(true, 29), st(true, 30)), null);
  assert.equal(announcementFor(st(true, 10), st(true, 11)), '10 seconds left. Press Enter to book.');
  assert.equal(announcementFor(st(true, 9), st(true, 10)), null);
});

test('a tick that skips a mark still announces it', () => {
  assert.equal(announcementFor(st(true, 28), st(true, 34)), '30 seconds left. Press Enter to book.');
  assert.equal(announcementFor(st(true, 4), st(true, 12)), '10 seconds left. Press Enter to book.');
});

test('a tick that skips both marks announces the larger one only, never two at once', () => {
  const out = announcementFor(st(true, 5), st(true, 40));
  assert.equal(out, '30 seconds left. Press Enter to book.');
});

test('counting back up (a re-hold) does not re-announce a mark', () => {
  assert.equal(announcementFor(st(true, 30), st(true, 8)), null);
  assert.equal(crossedMark(8, 30, 10), false);
  assert.equal(crossedMark(11, 10, 10), true);
});

test('running out announces once; staying disarmed stays silent', () => {
  assert.equal(announcementFor(st(false, 0), st(true, 1)), 'Hold expired. The slot went back to the list.');
  assert.equal(announcementFor(st(false, 0), st(false, 0)), null);
  // released with time on the clock: the surface that released it owns that message
  assert.equal(announcementFor(st(false, 12), st(true, 12)), null);
});

test('the marks are the shared thresholds, in descending order', () => {
  assert.deepEqual([...ANNOUNCE_MARKS], [30, 10]);
});

test('secondsPhrase pluralises and never announces a negative', () => {
  assert.equal(secondsPhrase(1), '1 second');
  assert.equal(secondsPhrase(2), '2 seconds');
  assert.equal(secondsPhrase(0), '0 seconds');
  assert.equal(secondsPhrase(-4), '0 seconds');
  assert.equal(secondsPhrase(9.2), '10 seconds');
});

test('blocked attempts get a polite sentence, and silence at zero', () => {
  assert.equal(blockedAnnouncement(0), null);
  assert.equal(blockedAnnouncement(-1), null);
  assert.match(blockedAnnouncement(1) ?? '', /^1 synthetic press blocked\./);
  assert.match(blockedAnnouncement(4) ?? '', /^4 synthetic presses blocked\./);
});

// --- urgency + copy --------------------------------------------------------

test('urgency follows the shared thresholds while armed and is calm while disarmed', () => {
  assert.equal(surfaceUrgency(true, 45), 'calm');
  assert.equal(surfaceUrgency(true, 31), 'calm');
  assert.equal(surfaceUrgency(true, 30), 'attention');
  assert.equal(surfaceUrgency(true, 11), 'attention');
  assert.equal(surfaceUrgency(true, 10), 'critical');
  assert.equal(surfaceUrgency(true, 0), 'critical');
  assert.equal(surfaceUrgency(false, 3), 'calm');
});

test('copy names the slot when armed and explains itself when there is nothing to press', () => {
  const held = surfaceCopy(st(true, 20));
  assert.equal(held.action, 'Book 9:20 AM with Dr. Okonjo');
  assert.equal(held.legend, 'press enter');
  assert.match(held.footnote, /only you can/);

  const idle = surfaceCopy(st(false, 0));
  assert.equal(idle.status, 'Nothing held');
  assert.match(idle.footnote, /When a slot drops/);

  const done = surfaceCopy(st(true, 0));
  assert.equal(done.status, 'Hold expired');
  assert.match(done.footnote, /ran out/);
});
