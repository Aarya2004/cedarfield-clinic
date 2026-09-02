import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LOCAL_REQUEST_WINDOW_MS,
  agentArrivalAnnouncement,
  holdGutterLabel,
  holdHeadline,
  holdOrigin,
} from './hold-origin.ts';

test('a hold with no local request behind it belongs to the agent', () => {
  assert.equal(holdOrigin(1000, null), 'agent');
});

test('a hold right after a local click belongs to you', () => {
  assert.equal(holdOrigin(1000, 990), 'you');
  assert.equal(holdOrigin(1000, 1000), 'you');
  assert.equal(holdOrigin(1000 + LOCAL_REQUEST_WINDOW_MS, 1000), 'you');
});

test('a hold long after the last local click belongs to the agent', () => {
  assert.equal(holdOrigin(1000 + LOCAL_REQUEST_WINDOW_MS + 1, 1000), 'agent');
  assert.equal(holdOrigin(60_000, 1000), 'agent');
});

test('a local request stamped after the hold cannot have caused it', () => {
  assert.equal(holdOrigin(1000, 1200), 'agent');
});

test('non-finite clocks fall back to the agent rather than claiming your click', () => {
  assert.equal(holdOrigin(Number.NaN, 1000), 'agent');
  assert.equal(holdOrigin(1000, Number.NaN), 'agent');
});

test('the headline is the sentence the board and the dock both carry', () => {
  assert.equal(holdHeadline('agent', 41), 'Held by your agent — 0:41 · one keypress books it');
  assert.equal(holdHeadline('you', 41), 'Held for you — 0:41 · one keypress books it');
});

test('the headline ceils, so it never reads 0:00 while there is time left', () => {
  assert.equal(holdHeadline('agent', 0.4), 'Held by your agent — 0:01 · one keypress books it');
  assert.equal(holdHeadline('agent', 0), 'Held by your agent — 0:00 · one keypress books it');
});

test('the gutter names the actor in the label column', () => {
  assert.equal(holdGutterLabel('agent'), 'Held — your agent');
  assert.equal(holdGutterLabel('you'), 'Held — yours');
});

test('only an agent hold is announced, and the announcement names the act you still owe', () => {
  assert.equal(
    agentArrivalAnnouncement('agent', '9:20 AM'),
    'Your agent holds 9:20 AM. Press Enter to book it — your agent cannot.',
  );
  assert.equal(agentArrivalAnnouncement('you', '9:20 AM'), null);
});

// ── SPEC-V5: a cascade grant has its own sentence ────────────────────────────────────────────
test('waitlist origin: headline and arrival say it came back, never "your agent"', () => {
  assert.match(holdHeadline('waitlist', 30), /It came back to you/);
  assert.match(String(agentArrivalAnnouncement('waitlist', '9:20 AM')), /came back to you from the waitlist/);
  assert.doesNotMatch(String(agentArrivalAnnouncement('waitlist', '9:20 AM')), /agent/);
});
