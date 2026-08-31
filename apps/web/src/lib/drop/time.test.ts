// Run: node --experimental-strip-types --test src/lib/drop/time.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clampSeconds,
  displaySeconds,
  dropAnnouncement,
  formatClock,
  fractionLeft,
  holdAnnouncement,
  secondsUntil,
  urgencyAt,
  urgencyColorAt,
} from './time.ts';
import { URGENCY_TOKEN } from './urgency.ts';

test('formatClock reads as a stopwatch under an hour and a clock past it', () => {
  assert.equal(formatClock(0), '0:00');
  assert.equal(formatClock(5), '0:05');
  assert.equal(formatClock(42), '0:42');
  assert.equal(formatClock(59), '0:59');
  assert.equal(formatClock(60), '1:00');
  assert.equal(formatClock(65), '1:05');
  assert.equal(formatClock(600), '10:00');
  assert.equal(formatClock(3599), '59:59');
  assert.equal(formatClock(3600), '1:00:00');
  assert.equal(formatClock(3661), '1:01:01');
});

test('a countdown never shows 0:00 while time is left — fractions ceil', () => {
  assert.equal(formatClock(0.01), '0:01');
  assert.equal(formatClock(19.4), '0:20');
  assert.equal(formatClock(20), '0:20');
  assert.equal(displaySeconds(0.2), 1);
  assert.equal(displaySeconds(20), 20);
});

test('negatives and non-finite numbers clamp to zero rather than rendering garbage', () => {
  assert.equal(clampSeconds(-3), 0);
  assert.equal(clampSeconds(-0.001), 0);
  assert.equal(clampSeconds(Number.NaN), 0);
  assert.equal(clampSeconds(Number.POSITIVE_INFINITY), 0);
  assert.equal(formatClock(-42), '0:00');
  assert.equal(formatClock(Number.NaN), '0:00');
  assert.equal(displaySeconds(-1), 0);
});

test('secondsUntil measures from the passed-in now and clamps a drop that already happened', () => {
  const now = 1_700_000_000_000;
  assert.equal(secondsUntil(new Date(now + 42_000), now), 42);
  assert.equal(secondsUntil(now + 500, now), 0.5);
  assert.equal(secondsUntil(now, now), 0);
  assert.equal(secondsUntil(now - 10_000, now), 0);
  assert.equal(formatClock(secondsUntil(new Date(now + 42_400), now)), '0:43');
  assert.equal(secondsUntil(new Date(Number.NaN), now), 0);
});

test('fractionLeft is clamped to 0..1 and survives a zero-length hold', () => {
  assert.equal(fractionLeft(20, 20), 1);
  assert.equal(fractionLeft(20, 10), 0.5);
  assert.equal(fractionLeft(20, 0), 0);
  assert.equal(fractionLeft(20, -5), 0);
  assert.equal(fractionLeft(20, 25), 1); // a hold cannot be more than full
  assert.equal(fractionLeft(0, 5), 0);
  assert.equal(fractionLeft(-1, 5), 0);
  assert.equal(fractionLeft(Number.NaN, 5), 0);
});

test('urgency thresholds hold exactly at their edges (shared with T1)', () => {
  assert.equal(urgencyAt(31), 'calm');
  assert.equal(urgencyAt(30), 'attention');
  assert.equal(urgencyAt(11), 'attention');
  assert.equal(urgencyAt(10), 'critical');
  assert.equal(urgencyAt(0), 'critical');
  assert.equal(urgencyAt(-5), 'critical'); // clamped, not calm
  assert.equal(urgencyColorAt(31), URGENCY_TOKEN.calm);
  assert.equal(urgencyColorAt(30), URGENCY_TOKEN.attention);
  assert.equal(urgencyColorAt(10), URGENCY_TOKEN.critical);
});

test('urgency follows the displayed integer, so colour and numeral never disagree', () => {
  // 10.4s displays as "0:11" — attention, not critical: the bar must not go red on a screen reading 11.
  assert.equal(formatClock(10.4), '0:11');
  assert.equal(urgencyAt(10.4), 'attention');
  assert.equal(formatClock(10), '0:10');
  assert.equal(urgencyAt(10), 'critical');
});

test('holdAnnouncement speaks only at milestones and at zero', () => {
  assert.equal(holdAnnouncement(45), '');
  assert.equal(holdAnnouncement(31), '');
  assert.equal(holdAnnouncement(30), '30 seconds left on your hold.');
  assert.equal(holdAnnouncement(11), '');
  assert.equal(holdAnnouncement(10), '10 seconds left on your hold.');
  assert.equal(holdAnnouncement(5), '5 seconds left on your hold.');
  assert.equal(holdAnnouncement(4), '');
  assert.equal(holdAnnouncement(0), 'Hold expired.');
  assert.equal(holdAnnouncement(-9), 'Hold expired.');
  assert.equal(holdAnnouncement(0, 'Seat'), 'Seat expired.');
  assert.equal(holdAnnouncement(10, 'Seat'), '10 seconds left on your seat.');
});

test('every frame inside one second yields the same sentence, so nothing is re-announced', () => {
  const frames = [10.0, 9.8, 9.5, 9.2, 9.01];
  const said = frames.map((f) => holdAnnouncement(f));
  assert.deepEqual(new Set(said), new Set(['10 seconds left on your hold.']));
});

test('dropAnnouncement is quieter than a hold and flips at zero', () => {
  assert.equal(dropAnnouncement(60), '');
  assert.equal(dropAnnouncement(30), 'Next drop in 30 seconds.');
  assert.equal(dropAnnouncement(10), 'Next drop in 10 seconds.');
  assert.equal(dropAnnouncement(5), ''); // a wait is not an emergency
  assert.equal(dropAnnouncement(0), 'Slots are dropping now.');
  assert.equal(dropAnnouncement(-1), 'Slots are dropping now.');
});
