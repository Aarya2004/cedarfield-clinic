// Run: node --experimental-strip-types --test src/lib/drop/confirm.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reduceConfirm, initialConfirm, DwellTracker, DWELL_MS, TOKEN_TTL_MS, type ConfirmState } from './confirm.ts';

const armed = (): ConfirmState => reduceConfirm(initialConfirm, { t: 'hold', holdId: 'h1', expiresAt: 100_000 });

test('happy path: hold → trusted key → token → confirming → booked', () => {
  let s = armed();
  s = reduceConfirm(s, { t: 'trusted_input', input: { kind: 'key' }, at: 1000 });
  assert.equal(s.phase, 'requesting');
  s = reduceConfirm(s, { t: 'token', at: 1200 });
  assert.equal(s.phase, 'confirming');
  s = reduceConfirm(s, { t: 'confirm_ok' });
  assert.equal(s.phase, 'booked');
});

test('inputs with nothing to confirm are ignored — a stray keydown can never book', () => {
  const s = reduceConfirm(initialConfirm, { t: 'trusted_input', input: { kind: 'key' }, at: 1 });
  assert.equal(s.phase, 'idle');
});

test('a slow token fails closed and re-arms (token_expired)', () => {
  let s = armed();
  s = reduceConfirm(s, { t: 'trusted_input', input: { kind: 'switch' }, at: 1000 });
  s = reduceConfirm(s, { t: 'token', at: 1000 + TOKEN_TTL_MS + 1 });
  assert.equal(s.phase, 'armed');
  assert.equal(s.error, 'token_expired');
});

test('hold lapse during requesting → lapsed, never booked', () => {
  let s = armed();
  s = reduceConfirm(s, { t: 'trusted_input', input: { kind: 'key' }, at: 99_500 });
  s = reduceConfirm(s, { t: 'tick', at: 100_001 });
  assert.equal(s.phase, 'lapsed');
  s = reduceConfirm(s, { t: 'token', at: 100_002 });
  assert.equal(s.phase, 'lapsed', 'a late token cannot resurrect a lapsed hold');
});

test('refusal re-arms with the same hold', () => {
  let s = armed();
  s = reduceConfirm(s, { t: 'trusted_input', input: { kind: 'key' }, at: 1 });
  s = reduceConfirm(s, { t: 'token', at: 2 });
  s = reduceConfirm(s, { t: 'confirm_refused' });
  assert.equal(s.phase, 'armed');
  assert.equal(s.holdId, 'h1');
});

test('a new hold re-arms after booked (next round)', () => {
  let s = armed();
  s = reduceConfirm(s, { t: 'trusted_input', input: { kind: 'key' }, at: 1 });
  s = reduceConfirm(s, { t: 'token', at: 2 });
  s = reduceConfirm(s, { t: 'confirm_ok' });
  s = reduceConfirm(s, { t: 'hold', holdId: 'h2', expiresAt: 200_000 });
  assert.equal(s.phase, 'armed');
  assert.equal(s.holdId, 'h2');
});

test('dwell: continuous hold above threshold fires once at DWELL_MS', () => {
  const d = new DwellTracker('Open_Palm', 0.6);
  assert.deepEqual(d.frame('Open_Palm', 0.9, 0), { progress: 0, fire: false });
  const mid = d.frame('Open_Palm', 0.9, DWELL_MS / 2);
  assert.ok(mid.progress > 0.4 && mid.progress < 0.6 && !mid.fire);
  assert.equal(d.frame('Open_Palm', 0.9, DWELL_MS).fire, true);
  assert.equal(d.frame('Open_Palm', 0.9, DWELL_MS + 100).fire, false, 'fires exactly once');
});

test('dwell: a flicker below threshold resets to zero — tremor never fires it', () => {
  const d = new DwellTracker('Open_Palm', 0.6);
  d.frame('Open_Palm', 0.9, 0);
  d.frame('Open_Palm', 0.9, 500);
  assert.deepEqual(d.frame('Open_Palm', 0.4, 600), { progress: 0, fire: false });
  const restart = d.frame('Open_Palm', 0.9, 700);
  assert.ok(restart.progress < 0.05, 'restarted from zero');
  assert.equal(d.frame('Open_Palm', 0.9, 700 + DWELL_MS - 1).fire, false);
  assert.equal(d.frame('Open_Palm', 0.9, 700 + DWELL_MS).fire, true);
});

test('dwell: the wrong gesture never accumulates', () => {
  const d = new DwellTracker('Open_Palm', 0.6);
  for (let t = 0; t <= DWELL_MS * 2; t += 100) {
    assert.equal(d.frame('Thumb_Up', 0.99, t).fire, false);
  }
});
