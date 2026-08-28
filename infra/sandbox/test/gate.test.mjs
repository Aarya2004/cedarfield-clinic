// node --experimental-strip-types --test infra/sandbox/test/gate.test.mjs — pure decision logic, no platform.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, WINDOW_MS } from '../src/gate-logic.ts';

const now = 1_000_000_000_000;
const row = (sid, createdAgoMs, ttlMs = 1_800_000) => ({ sid, created_at: now - createdAgoMs, expires_at: now - createdAgoMs + ttlMs });

test('fresh IP is allowed', () => {
  assert.deepEqual(decide([], now, 1, 3), { ok: true, active: 0 });
});

test('second session within 10 min is rate-limited with retry_after', () => {
  const d = decide([row('a', 60_000)], now, 1, 3);
  assert.equal(d.ok, false);
  assert.equal(d.reason, 'rate');
  assert.equal(d.retry_after_s, Math.ceil((WINDOW_MS - 60_000) / 1000));
});

test('rate window: 1 per 10 min even when the old session already ended', () => {
  const d = decide([row('a', 5 * 60_000, 60_000)], now, 1, 3); // ended 4 min ago, created 5 min ago
  assert.equal(d.ok, false);
  assert.equal(d.reason, 'rate');
  assert.equal(d.retry_after_s, Math.ceil((WINDOW_MS - 5 * 60_000) / 1000));
});

test('after the window a new session is allowed; concurrent cap applies', () => {
  assert.equal(decide([row('a', 11 * 60_000, 60_000)], now, 1, 3).ok, true);
  const three = [row('a', 20 * 60_000), row('b', 15 * 60_000), row('c', 12 * 60_000)];
  const d = decide(three, now, 10, 3);
  assert.equal(d.ok, false);
  assert.equal(d.reason, 'concurrent');
  assert.ok(d.retry_after_s > 0);
});

test('expired rows are ignored for concurrency', () => {
  const d = decide([row('a', 40 * 60_000), row('b', 35 * 60_000)], now, 10, 1);
  assert.equal(d.ok, true);
});
