// Run: node --experimental-strip-types --test src/lib/webmcp/kept.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEPT_KEY, KEPT_CAP, loadKept, persistKept, verifyKeptHashes, keptFromTools, clearKept, type KeptTool } from './kept.ts';
import type { ForgeSpec } from './forge-spec.ts';

const spec = (name: string): ForgeSpec => ({
  name,
  description: 'Top N Hacker News titles via rokan do.',
  commands: ['rokan do "top {{n}} HN titles"'],
  params: [{ name: 'n', description: 'How many titles', example: '5' }],
  kind: 'read',
});

const kept = (name: string, hash = `h_${name}`): KeptTool => ({
  spec: spec(name),
  hash,
  pinned: false,
  forged_at: '2026-08-29T00:00:00.000Z',
});

class MemStorage {
  map = new Map<string, string>();
  reads = 0;
  writes = 0;
  getItem(k: string): string | null {
    this.reads++;
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string): void {
    this.writes++;
    this.map.set(k, v);
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
}

test('round-trips a kept tool through persist + load', () => {
  const s = new MemStorage();
  const one = { ...kept('hn_top'), forged_by: 'arav', pinned: true };
  persistKept(s, [one]);
  const back = loadKept(s);
  assert.equal(back.length, 1);
  assert.deepEqual(back[0], one);
});

test('null storage is safe both ways', () => {
  assert.deepEqual(loadKept(null), []);
  persistKept(null, [kept('hn_top')]); // no throw
  clearKept(null); // no throw
});

test('corrupt JSON yields nothing, never throws', () => {
  const s = new MemStorage();
  s.map.set(KEPT_KEY, '{not json');
  assert.deepEqual(loadKept(s), []);
});

test('a non-object / missing tools array is ignored', () => {
  const s = new MemStorage();
  s.map.set(KEPT_KEY, JSON.stringify({ v: 1 }));
  assert.deepEqual(loadKept(s), []);
  s.map.set(KEPT_KEY, JSON.stringify([1, 2, 3]));
  assert.deepEqual(loadKept(s), []);
});

test('entries failing spec validation are dropped, valid ones kept', () => {
  const s = new MemStorage();
  const bad = { spec: { ...spec('Bad Name'), name: 'Bad Name' }, hash: 'h', forged_at: 'x', pinned: false };
  const good = kept('good_one');
  s.map.set(KEPT_KEY, JSON.stringify({ v: 1, tools: [bad, good] }));
  const back = loadKept(s);
  assert.equal(back.length, 1);
  assert.equal(back[0].spec.name, 'good_one');
});

test('entries missing hash or forged_at are dropped', () => {
  const s = new MemStorage();
  const noHash = { spec: spec('aa'), forged_at: 'x', pinned: false };
  const noDate = { spec: spec('bb'), hash: 'h', pinned: false };
  s.map.set(KEPT_KEY, JSON.stringify({ v: 1, tools: [noHash, noDate, kept('cc')] }));
  const back = loadKept(s);
  assert.deepEqual(back.map((k) => k.spec.name), ['cc']);
});

test('duplicate names collapse to the last written', () => {
  const s = new MemStorage();
  const first = { ...kept('dup'), hash: 'first' };
  const second = { ...kept('dup'), hash: 'second' };
  s.map.set(KEPT_KEY, JSON.stringify({ v: 1, tools: [first, second] }));
  const back = loadKept(s);
  assert.equal(back.length, 1);
  assert.equal(back[0].hash, 'second');
});

test('capped at KEPT_CAP on both persist and load', () => {
  const s = new MemStorage();
  const many = Array.from({ length: KEPT_CAP + 5 }, (_, i) => kept(`t${i}`));
  persistKept(s, many);
  assert.equal(loadKept(s).length, KEPT_CAP);
  // even a hand-written over-cap store is trimmed on load
  s.map.set(KEPT_KEY, JSON.stringify({ v: 1, tools: many }));
  assert.equal(loadKept(s).length, KEPT_CAP);
});

test('persist([]) clears the store', () => {
  const s = new MemStorage();
  persistKept(s, [kept('xx')]);
  assert.equal(loadKept(s).length, 1);
  persistKept(s, []);
  assert.equal(s.map.has(KEPT_KEY), false);
});

test('a throwing localStorage degrades to nothing kept', () => {
  const throwing = {
    getItem() {
      throw new Error('SecurityError');
    },
    setItem() {
      throw new Error('QuotaExceeded');
    },
    removeItem() {
      throw new Error('nope');
    },
  };
  assert.deepEqual(loadKept(throwing), []);
  persistKept(throwing, [kept('x')]); // swallowed
  clearKept(throwing); // swallowed
});

test('loadKept never writes — it only reads (no auto-register side effects)', () => {
  const s = new MemStorage();
  persistKept(s, [kept('aa')]);
  const writesBefore = s.writes;
  loadKept(s);
  loadKept(s);
  assert.equal(s.writes, writesBefore); // reading kept tools mutates nothing
});

test('verifyKeptHashes flags a spec that no longer hashes to its stored hash', async () => {
  const entries = [kept('stable', 'H1'), kept('drifted', 'OLD')];
  // hashOf returns H1 for everything → 'stable' matches, 'drifted' does not
  const verified = await verifyKeptHashes(entries, async () => 'H1');
  const byName = Object.fromEntries(verified.map((v) => [v.entry.spec.name, v.changed]));
  assert.equal(byName.stable, false);
  assert.equal(byName.drifted, true);
});

test('verifyKeptHashes fails closed when hashOf throws', async () => {
  const verified = await verifyKeptHashes([kept('x', 'H')], async () => {
    throw new Error('bad spec');
  });
  assert.equal(verified[0].changed, true);
});

test('keptFromTools maps engine tools (epoch ms -> ISO forged_at), passing round-trip', () => {
  const s2 = new MemStorage();
  const engineTools = [
    { spec: spec('hn_top'), hash: 'H', pinned: true, forgedAt: 1756400000000, forged_by: 'arav' },
    { spec: spec('status'), hash: 'S', pinned: false, forgedAt: Number.NaN }, // bad ts -> now, never Invalid Date
  ];
  const mapped = keptFromTools(engineTools);
  assert.equal(mapped[0].forged_at, new Date(1756400000000).toISOString());
  assert.equal(mapped[0].forged_by, 'arav');
  assert.equal(Number.isNaN(Date.parse(mapped[1].forged_at)), false); // valid ISO
  persistKept(s2, mapped);
  assert.equal(loadKept(s2).length, 2); // survives a persist/load round-trip
});
