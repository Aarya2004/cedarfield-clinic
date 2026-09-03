import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PHRASES, PHRASES_KEY, cleanPhrases, loadPhrases, savePhrases } from './phrase-board.ts';

function memStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}

test('defaults are eight short sentences and always include yes, no and stop', () => {
  assert.equal(DEFAULT_PHRASES.length, 8);
  for (const w of ['yes', 'no', 'stop']) assert.ok(DEFAULT_PHRASES.includes(w));
  assert.ok(DEFAULT_PHRASES.every((p) => p.length <= 40));
});

test('cleanPhrases trims, dedupes, caps at 12 and 120 chars, and never returns an empty board', () => {
  assert.deepEqual(cleanPhrases(['  hold   me ', 'hold me', '', 7, 'x'.repeat(200)]), ['hold me', 'x'.repeat(120)]);
  assert.deepEqual(cleanPhrases(Array.from({ length: 20 }, (_, i) => `p${i}`)).length, 12);
  assert.deepEqual(cleanPhrases([]), [...DEFAULT_PHRASES]);
  assert.deepEqual(cleanPhrases('nope'), [...DEFAULT_PHRASES]);
});

test('load and save: the defaults are never written; a custom board round-trips; junk falls back', () => {
  const s = memStore();
  assert.deepEqual(loadPhrases(s), [...DEFAULT_PHRASES]);
  savePhrases(s, DEFAULT_PHRASES);
  assert.equal(s.m.has(PHRASES_KEY), false);
  savePhrases(s, ['book me tuesday', 'yes']);
  assert.deepEqual(loadPhrases(s), ['book me tuesday', 'yes']);
  s.setItem(PHRASES_KEY, '{not json');
  assert.deepEqual(loadPhrases(s), [...DEFAULT_PHRASES]);
  assert.deepEqual(loadPhrases(null), [...DEFAULT_PHRASES]);
});
