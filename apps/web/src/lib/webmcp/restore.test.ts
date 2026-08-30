import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEPT_KEY, loadKept, persistKept, type KeptTool } from './kept.ts';
import { createKeptWriter, keptEntriesFor, pendingKept, restoreKept, restoreRows, restoreSummary, type ForgedLike, type RestoreEngine } from './restore.ts';
import type { ForgeError, ForgeSpec } from './forge-spec.ts';

function spec(name: string, command = 'ls -la'): ForgeSpec {
  return { name, description: `does ${name}`, commands: [command], params: [], kind: 'read' };
}
function forged(name: string, hash: string, forgedAt = 1000): ForgedLike {
  return { name, spec: spec(name), hash, pinned: false, forgedAt, forged_by: 'you' };
}
function kept(name: string, hash: string): KeptTool {
  return { spec: spec(name), hash, pinned: false, forged_at: '2026-08-30T00:00:00.000Z' };
}

/** A localStorage stand-in; `fail` makes every access throw, like a blocked private-mode store. */
function memStore(fail = false) {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => {
      if (fail) throw new Error('blocked');
      return map.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (fail) throw new Error('blocked');
      map.set(k, v);
    },
    removeItem: (k: string) => {
      if (fail) throw new Error('blocked');
      map.delete(k);
    },
  };
}

// ---------- the mapper ----------

test('keptEntriesFor moves forgedAt from the monotonic clock onto the wall clock', () => {
  const origin = Date.parse('2026-08-30T12:00:00.000Z');
  const [e] = keptEntriesFor([forged('deploy', 'aaaaaaaaaaaa', 2_500)], origin);
  assert.equal(e.forged_at, '2026-08-30T12:00:02.500Z');
  assert.equal(e.forged_by, 'you');
});

test('keptEntriesFor survives a non-finite timeOrigin (never Invalid Date)', () => {
  const [e] = keptEntriesFor([forged('deploy', 'aaaaaaaaaaaa', 5)], Number.NaN);
  assert.ok(!Number.isNaN(Date.parse(e.forged_at)));
});

test('pendingKept offers only the entries no live tool already carries', () => {
  const store = [kept('alpha', 'h1'), kept('beta', 'h2')];
  assert.deepEqual(pendingKept(store, [{ name: 'alpha' }]).map((k) => k.spec.name), ['beta']);
  assert.equal(pendingKept(store, [{ name: 'alpha' }, { name: 'beta' }]).length, 0);
});

// ---------- the write path ----------

test('the writer mirrors live tools into the store and skips an unchanged write', () => {
  const s = memStore();
  let tools: ForgedLike[] = [forged('alpha', 'h1')];
  let writes = 0;
  const w = createKeptWriter({
    storage: s,
    tools: () => tools,
    timeOrigin: 0,
    persist: (st, list) => {
      writes++;
      persistKept(st, list);
    },
  });
  w.write();
  w.write();
  assert.equal(writes, 1, 'an unchanged tool list must not rewrite the store');
  assert.deepEqual(loadKept(s).map((k) => k.spec.name), ['alpha']);
  tools = [forged('alpha', 'h1'), forged('beta', 'h2')];
  w.write();
  assert.equal(writes, 2);
  assert.deepEqual(loadKept(s).map((k) => k.spec.name), ['alpha', 'beta']);
});

test('regression: the first emit of a session (no tools yet) must not erase an unrestored store', () => {
  const s = memStore();
  persistKept(s, [kept('alpha', 'h1'), kept('beta', 'h2')]);
  const loaded = loadKept(s);
  let tools: ForgedLike[] = [];
  const w = createKeptWriter({ storage: s, tools: () => tools, loaded, timeOrigin: 0, persist: persistKept });
  w.write(); // an opening forge card emits before anything is registered
  assert.deepEqual(loadKept(s).map((k) => k.spec.name), ['alpha', 'beta']);
  // restoring `alpha` replaces the retained copy with the live one; `beta` is still kept
  tools = [forged('alpha', 'h1-new')];
  w.write();
  assert.deepEqual(loadKept(s).map((k) => [k.spec.name, k.hash]), [['alpha', 'h1-new'], ['beta', 'h2']]);
  assert.deepEqual(w.retained().map((k) => k.spec.name), ['beta']);
});

test('a tool restored and then unforged is forgotten, not resurrected', () => {
  const s = memStore();
  persistKept(s, [kept('alpha', 'h1')]);
  let tools: ForgedLike[] = [];
  const w = createKeptWriter({ storage: s, tools: () => tools, loaded: loadKept(s), timeOrigin: 0, persist: persistKept });
  tools = [forged('alpha', 'h1')];
  w.write();
  tools = [];
  w.write();
  assert.deepEqual(loadKept(s), []);
  assert.equal(s.map.has(KEPT_KEY), false, 'an empty list clears the store');
});

test('a throwing localStorage degrades to nothing kept, never a throw', () => {
  const s = memStore(true);
  const w = createKeptWriter({ storage: s, tools: () => [forged('alpha', 'h1')], timeOrigin: 0, persist: persistKept });
  assert.doesNotThrow(() => w.write());
});

// ---------- the restore path ----------

function fakeEngine(over: Partial<RestoreEngine> = {}): RestoreEngine & { opened: string[] } {
  const opened: string[] = [];
  return {
    opened,
    openCard(s: unknown, opts) {
      assert.equal(opts.origin, 'human');
      opened.push((s as ForgeSpec).name);
      return { card_id: `c_${(s as ForgeSpec).name}` };
    },
    approve(card_id: string) {
      return Promise.resolve({ hash: `hash_${card_id}` });
    },
    ...over,
  };
}

test('restore opens one approval card per entry, in order, and writes one ledger row each', async () => {
  const rows: { kind: string; fields: Record<string, unknown> }[] = [];
  const engine = fakeEngine();
  const out = await restoreKept([kept('alpha', 'h1'), kept('beta', 'h2')], {
    engine,
    ledger: { append: (kind, fields) => rows.push({ kind, fields }) },
  });
  assert.deepEqual(engine.opened, ['alpha', 'beta'], 'sequential, never a batch of cards at once');
  assert.deepEqual(out.map((o) => o.status), ['restored', 'restored']);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].kind, 'restored');
  assert.deepEqual(rows[0].fields, { name: 'alpha', tool: 'forged_alpha', hash: 'hash_c_alpha', source: 'kept', drifted: true });
});

test('a hard-blocked kept spec is never confirmed by the batch — its card waits in Forge', async () => {
  const err: ForgeError = { error: 'needs_confirmation', detail: 'a command matches a hard-blocked pattern' };
  const engine = fakeEngine({ approve: () => Promise.resolve(err) });
  const rows: unknown[] = [];
  const out = await restoreKept([kept('rm_it', 'h1')], { engine, ledger: { append: (k, f) => rows.push([k, f]) } });
  assert.equal(out[0].status, 'needs_card');
  assert.equal(rows.length, 0, 'nothing was registered, so nothing is countersigned as restored');
  assert.match(restoreSummary(out), /1 waiting in Forge/);
});

test('a rejected card and a throwing engine are outcomes, never exceptions', async () => {
  const bad = fakeEngine({ openCard: () => ({ error: 'invalid_name', detail: 'nope' }) as ForgeError });
  const out1 = await restoreKept([kept('alpha', 'h1')], { engine: bad });
  assert.deepEqual(out1, [{ name: 'alpha', status: 'failed', error: 'invalid_name', detail: 'nope' }]);

  const boom = fakeEngine({
    approve: () => {
      throw new Error('registerTool exploded');
    },
  });
  const out2 = await restoreKept([kept('alpha', 'h1')], { engine: boom });
  assert.equal(out2[0].status, 'failed');
  assert.match(restoreSummary(out2), /alpha failed: registerTool exploded/);
});

test('a batch continues past one failure', async () => {
  let n = 0;
  const engine = fakeEngine({
    approve: (id: string) => (n++ === 0 ? Promise.resolve({ error: 'unpin_one' } as ForgeError) : Promise.resolve({ hash: `hash_${id}` })),
  });
  const out = await restoreKept([kept('alpha', 'h1'), kept('beta', 'h2')], { engine });
  assert.deepEqual(out.map((o) => o.status), ['failed', 'restored']);
  assert.equal(restoreSummary(out), '1 restored · alpha failed: unpin_one');
});

test('a ledger that throws never aborts the batch', async () => {
  const out = await restoreKept([kept('alpha', 'h1')], {
    engine: fakeEngine(),
    ledger: {
      append: () => {
        throw new Error('no crypto');
      },
    },
  });
  assert.equal(out[0].status, 'restored');
});

// ---------- the rows the card paints ----------

test('drifted entries sort first and keep their stored hash', () => {
  const rows = restoreRows([
    { entry: kept('alpha', 'h1'), changed: false },
    { entry: kept('beta', 'h2'), changed: true },
  ]);
  assert.deepEqual(rows, [
    { name: 'beta', tool: 'forged_beta', hash: 'h2', changed: true },
    { name: 'alpha', tool: 'forged_alpha', hash: 'h1', changed: false },
  ]);
});
