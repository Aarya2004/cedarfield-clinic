// Run: node --experimental-strip-types --test src/lib/terminal/judge-resume.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clearJudgePairing, loadJudgePairing, saveJudgePairing, JUDGE_KEY } from './judge-resume.ts';

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
};

test('regression (Fable VERIFY P1): a judge pairing survives a reload while unexpired, and is dropped when expired or cleared', () => {
  const s = mem();
  const now = 1_800_000_000_000;
  saveJudgePairing(s, { ws: 'wss://w/ws/abc.1.sig', token: 't' }, 1_800_000, now);
  assert.deepEqual(loadJudgePairing(s, now + 60_000), { ws: 'wss://w/ws/abc.1.sig', token: 't', expires_at: now + 1_800_000 });
  assert.equal(loadJudgePairing(s, now + 1_800_000 - 30_000), null); // < 60 s left: not worth resuming
  assert.equal(s.m.has(JUDGE_KEY), false); // stale entry removed
  saveJudgePairing(s, { ws: 'wss://w/ws/abc.1.sig', token: 't' }, 1_800_000, now);
  clearJudgePairing(s);
  assert.equal(loadJudgePairing(s, now), null);
  s.setItem(JUDGE_KEY, '{not json');
  assert.equal(loadJudgePairing(s, now), null);
  assert.equal(loadJudgePairing(null, now), null);
});
