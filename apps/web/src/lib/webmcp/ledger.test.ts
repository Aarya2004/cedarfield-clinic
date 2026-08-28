// Run: node --experimental-strip-types --test src/lib/webmcp/ledger.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ledger, verifyExport } from './ledger.ts';

test('rows chain and verify; tampering is detected', async () => {
  const l = new Ledger();
  await l.append('proposed', { proposal_id: 'p1', command: 'ls' });
  await l.append('executed', { proposal_id: 'p1', exit_code: 0, ms: 12 });
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
