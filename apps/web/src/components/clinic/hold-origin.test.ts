import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ASSISTANT_TAG,
  LOCAL_REQUEST_WINDOW_MS,
  agentArrivalAnnouncement,
  assistantTag,
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

test('the headline reads the same however the time was reserved', () => {
  assert.equal(holdHeadline('agent', 41), 'This time is held for you — 0:41');
  assert.equal(holdHeadline('you', 5), 'This time is held for you — 0:05');
});

test('the headline ceils, so it never reads 0:00 while there is time left', () => {
  assert.equal(holdHeadline('you', 0.4), 'This time is held for you — 0:01');
  assert.equal(holdHeadline('agent', 0), 'This time is held for you — 0:00');
});

test('only a hold the assistant asked for carries the tag', () => {
  assert.equal(assistantTag('agent'), ASSISTANT_TAG);
  assert.equal(assistantTag('agent'), 'via your assistant');
  assert.equal(assistantTag('you'), null);
});

// ── SPEC-V5: a cascade grant has its own sentence ────────────────────────────────────────────
test('waitlist origin: headline and arrival say it came back, never "your agent"', () => {
  assert.equal(holdHeadline('waitlist', 30), 'This time came back to you — 0:30');
  assert.match(String(agentArrivalAnnouncement('waitlist', '9:20 AM')), /came back to you from the waiting list/);
  assert.doesNotMatch(String(agentArrivalAnnouncement('waitlist', '9:20 AM')), /agent|assistant/);
  assert.equal(agentArrivalAnnouncement('you', '9:20 AM'), null);
  assert.match(String(agentArrivalAnnouncement('agent', '9:20 AM')), /via your assistant/);
});
