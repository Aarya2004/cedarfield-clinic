// Run: node --experimental-strip-types --test src/lib/drop/tax.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TaxMeter, SCROLL_BURST_MS } from './tax.ts';

const meterAt = (mode: 'manual' | 'agent') => {
  let t = 1000;
  const m = new TaxMeter(mode, () => t);
  return { m, tick: (ms: number) => { t += ms; } };
};

test('every counted event adds one; totals add up', () => {
  const { m } = meterAt('manual');
  assert.equal(m.record('pointer'), true);
  assert.equal(m.record('key'), true);
  assert.equal(m.record('gesture'), true);
  const s = m.snapshot();
  assert.equal(s.total, 3);
  assert.deepEqual(s.counts, { pointer: 1, key: 1, scroll: 0, gesture: 1 });
});

test('held-key repeats never count (a switch user pays per press, not per repeat)', () => {
  const { m } = meterAt('manual');
  assert.equal(m.record('key'), true);
  assert.equal(m.record('key', { repeat: true }), false);
  assert.equal(m.record('key', { repeat: true }), false);
  assert.equal(m.snapshot().counts.key, 1);
});

test('a scroll burst counts once; a pause starts a new one', () => {
  const { m, tick } = meterAt('manual');
  assert.equal(m.record('scroll'), true);
  tick(SCROLL_BURST_MS - 50);
  assert.equal(m.record('scroll'), false, 'same burst');
  tick(SCROLL_BURST_MS - 50);
  assert.equal(m.record('scroll'), false, 'burst extends from the LAST event, not the first');
  tick(SCROLL_BURST_MS + 1);
  assert.equal(m.record('scroll'), true, 'new burst');
  assert.equal(m.snapshot().counts.scroll, 2);
});

test('reset zeroes counts and restarts the clock', () => {
  const { m, tick } = meterAt('agent');
  m.record('pointer');
  tick(500);
  m.reset();
  const s = m.snapshot();
  assert.equal(s.total, 0);
  assert.equal(s.startedAt, 1500);
});

test('modes are independent meters — the on-screen claim is manual.total vs agent.total', () => {
  const { m: manual } = meterAt('manual');
  const { m: agent } = meterAt('agent');
  for (let i = 0; i < 42; i++) manual.record(i % 3 === 0 ? 'key' : 'pointer');
  agent.record('key'); // enable
  agent.record('gesture'); // the confirm
  assert.equal(manual.snapshot().total, 42);
  assert.equal(agent.snapshot().total, 2);
});
