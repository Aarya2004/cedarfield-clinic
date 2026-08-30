// node --experimental-strip-types --test infra/sandbox/test/model-budget.test.mjs — pure budget decision.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideCharge, DAY_MS, WINDOW_MS, gateKey } from '../src/gate-logic.ts';

const now = 1_700_000_000_000;
const exp = now + 20 * 60_000;
const caps = { perSid: 30, perSidPerMin: 10, perSidInflight: 1, perIpPerWindow: 60, perDay: 600, usdTotalMicros: 40_000_000 };
const fresh = () => ({ sidCalls: 0, sidCallsLastMin: 0, sidInflight: 0, ipCallsInWindow: 0, ipOldestAt: null, dayCalls: 0, dayOldestAt: null, usdTotalMicros: 0 });

test('fresh session is charged', () => {
  assert.deepEqual(decideCharge(fresh(), 1, 20_000, caps, now, exp), { ok: true });
});

test('all-time USD cap trips first and is pessimistic about the estimate', () => {
  const d = decideCharge({ ...fresh(), usdTotalMicros: 39_990_000 }, 1, 20_000, caps, now, exp);
  assert.equal(d.ok, false);
  assert.equal(d.reason, 'usd');
  assert.equal(d.retry_after_s, 86_400);
  assert.equal(decideCharge({ ...fresh(), usdTotalMicros: 39_970_000 }, 1, 20_000, caps, now, exp).ok, true);
});

test('daily call cap: retry until the oldest call leaves the day window', () => {
  const d = decideCharge({ ...fresh(), dayCalls: 600, dayOldestAt: now - DAY_MS + 5000 }, 1, 1, caps, now, exp);
  assert.equal(d.ok, false);
  assert.equal(d.reason, 'day');
  assert.equal(d.retry_after_s, 5);
  assert.equal(decideCharge({ ...fresh(), dayCalls: 599, dayOldestAt: now - 1000 }, 1, 1, caps, now, exp).ok, true);
});

test('per-IP window cap', () => {
  const d = decideCharge({ ...fresh(), ipCallsInWindow: 60, ipOldestAt: now - WINDOW_MS + 30_000 }, 1, 1, caps, now, exp);
  assert.equal(d.ok, false);
  assert.equal(d.reason, 'ip');
  assert.equal(d.retry_after_s, 30);
});

test('per-sid session cap: retry is the session expiry; weight counts', () => {
  const d = decideCharge({ ...fresh(), sidCalls: 30 }, 1, 1, caps, now, exp);
  assert.equal(d.ok, false);
  assert.equal(d.reason, 'sid');
  assert.equal(d.retry_after_s, Math.ceil((exp - now) / 1000));
  // 28 used + a sonnet call (weight 3) would exceed 30
  assert.equal(decideCharge({ ...fresh(), sidCalls: 28 }, 3, 1, caps, now, exp).ok, false);
  assert.equal(decideCharge({ ...fresh(), sidCalls: 27 }, 3, 1, caps, now, exp).ok, true);
});

test('burst and in-flight caps', () => {
  const b = decideCharge({ ...fresh(), sidCallsLastMin: 10 }, 1, 1, caps, now, exp);
  assert.equal(b.ok, false);
  assert.equal(b.reason, 'burst');
  assert.ok(b.retry_after_s >= 1 && b.retry_after_s <= 60);
  const i = decideCharge({ ...fresh(), sidInflight: 1 }, 1, 1, caps, now, exp);
  assert.equal(i.ok, false);
  assert.equal(i.reason, 'inflight');
});

test('precedence: usd → day → ip → sid → burst → inflight', () => {
  const all = { sidCalls: 99, sidCallsLastMin: 99, sidInflight: 9, ipCallsInWindow: 99, ipOldestAt: now, dayCalls: 999, dayOldestAt: now, usdTotalMicros: 99_000_000 };
  assert.equal(decideCharge(all, 1, 1, caps, now, exp).reason, 'usd');
  assert.equal(decideCharge({ ...all, usdTotalMicros: 0 }, 1, 1, caps, now, exp).reason, 'day');
  assert.equal(decideCharge({ ...all, usdTotalMicros: 0, dayCalls: 0 }, 1, 1, caps, now, exp).reason, 'ip');
  assert.equal(decideCharge({ ...all, usdTotalMicros: 0, dayCalls: 0, ipCallsInWindow: 0 }, 1, 1, caps, now, exp).reason, 'sid');
});

test('an expired session is refused outright', () => {
  const d = decideCharge(fresh(), 1, 1, caps, now, now - 1);
  assert.equal(d.ok, false);
  assert.equal(d.reason, 'sid');
});

test('gateKey: IPv6 clients are keyed by /64, IPv4 by address', () => {
  assert.equal(gateKey('203.0.113.7'), '203.0.113.7');
  assert.equal(gateKey('2001:db8:85a3:8d3:1319:8a2e:370:7348'), '2001:db8:85a3:8d3::/64');
  assert.equal(gateKey('2001:db8:85a3:8d3:ffff:8a2e:370:1'), '2001:db8:85a3:8d3::/64');
  assert.equal(gateKey('2001:db8::1'), '2001:db8:0:0::/64');
  assert.equal(gateKey(''), '0.0.0.0');
});
