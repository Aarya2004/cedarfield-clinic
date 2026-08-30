// Run: node --experimental-strip-types --test src/lib/webmcp/ledger.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ledger, verifyExport } from './ledger.ts';

test('rows chain and verify; tampering is detected', async () => {
  const l = new Ledger();
  await l.append('proposed', { proposal_id: 'p1', command: 'ls' });
  await l.append('executed_step', { proposal_id: 'p1', exit_code: 0, ms: 12 });
  const forwarded: string[] = [];
  l.setForward((r) => forwarded.push(r.kind));
  await l.append('screen_read', { lines: 60, redactions: 1 });
  assert.deepEqual(forwarded, ['screen_read']);

  const x = l.export({ includeKey: true });
  assert.equal(x.rows.length, 3);
  assert.equal(x.rows[0].prev, '');
  assert.equal(x.rows[1].prev, x.rows[0].sig);
  assert.deepEqual(await verifyExport(x), { ok: true, rows: 3, firstBad: null });

  const tampered = { ...x, rows: x.rows.map((r) => (r.seq === 2 ? { ...r, fields: { ...r.fields, exit_code: 1 } } : r)) };
  const v = await verifyExport(tampered);
  assert.equal(v.ok, false);
  assert.equal(v.firstBad, 2);
});

test('concurrent appends never interleave the chain', async () => {
  const l = new Ledger();
  await Promise.all([1, 2, 3, 4, 5].map((i) => l.append('proposed', { i })));
  const x = l.export({ includeKey: true });
  assert.deepEqual(x.rows.map((r) => r.seq), [1, 2, 3, 4, 5]);
  assert.equal((await verifyExport(x)).ok, true);
});

test('export never carries the key unless asked; countersign attaches bridge_sig once', async () => {
  const l = new Ledger();
  await l.append('proposed', { command: 'ls' });
  assert.equal(l.export().key_hex, undefined);
  assert.equal(l.export().countersigned, 0);
  assert.equal((await verifyExport(l.export())).ok, false); // cannot verify without the key — by design
  l.countersign(1, 7, 'a'.repeat(64));
  l.countersign(1, 8, 'b'.repeat(64)); // second ack ignored
  assert.equal(l.export().rows[0].bridge_sig, 'a'.repeat(64));
  assert.equal(l.export().rows[0].bridge_seq, 7);
  assert.equal(l.export().countersigned, 1);
});

test('cap: oldest rows are evicted, seq stays honest, dropped is counted, the export still verifies', async () => {
  const l = new Ledger({ maxRows: 5 });
  for (let i = 1; i <= 8; i++) await l.append('proposed', { i });
  assert.equal(l.snapshot().length, 5);
  assert.equal(l.dropped, 3);
  assert.deepEqual(l.snapshot().map((r) => r.seq), [4, 5, 6, 7, 8]);
  const x = l.export({ includeKey: true });
  assert.equal(x.dropped, 3);
  assert.deepEqual(await verifyExport(x), { ok: true, rows: 5, firstBad: null });
  // a countersign for an evicted seq is ignored, one for a kept seq lands
  l.countersign(2, 1, 'a'.repeat(64));
  l.countersign(6, 2, 'b'.repeat(64));
  assert.equal(l.export().countersigned, 1);
  assert.equal(l.snapshot()[2].bridge_sig, 'b'.repeat(64));
});

test('persist is throttled: many appends → one localStorage write, trailing', async () => {
  const writes: string[] = [];
  const g = globalThis as { window?: unknown };
  const saved = g.window;
  g.window = { localStorage: { setItem: (_k: string, v: string) => writes.push(v) } };
  try {
    const l = new Ledger();
    await Promise.all([1, 2, 3, 4, 5].map((i) => l.append('proposed', { i })));
    l.countersign(1, 1, 'c'.repeat(64));
    // other tests' ledgers may flush their own trailing write into this stub: count only ours
    const mine = () => writes.map((w) => JSON.parse(w) as { session: string; rows: unknown[] }).filter((x) => x.session === l.session);
    assert.equal(mine().length, 0, 'nothing is written synchronously');
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(mine().length, 1, 'one trailing write for the burst');
    assert.equal(mine()[0].rows.length, 5);
  } finally {
    if (saved === undefined) delete g.window;
    else g.window = saved;
  }
});
