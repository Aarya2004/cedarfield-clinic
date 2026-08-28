// Run: node --experimental-strip-types --test src/lib/webmcp/proposals.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ProposalStore } from './proposals.ts';

test('propose → pending → resolve accepted with measured latency', async () => {
  const s = new ProposalStore();
  const p = s.propose('ls', 'why');
  assert.equal(p.status, 'awaiting_human');
  assert.equal(s.pending()?.id, p.id);
  assert.equal(s.has(p.id), true);
  assert.equal(s.has('nope'), false);
  const w = s.wait(p.id, 1000);
  s.resolve(p.id, 'accepted');
  const r = await w;
  assert.equal(r?.status, 'accepted');
  assert.ok((r?.resolvedAt ?? 0) >= (r?.proposedAt ?? 0));
  assert.equal(s.pending(), undefined);
});

test('queued proposals are not pending until promoted; wait treats them as pending', async () => {
  const s = new ProposalStore();
  const a = s.propose('one', 'step 1', { invocation_id: 'inv1', step: 0 });
  const b = s.propose('two', 'step 2', { queued: true, invocation_id: 'inv1', step: 1 });
  assert.equal(b.status, 'queued');
  assert.equal(s.pending()?.id, a.id);
  const wb = s.wait(b.id, 1000);
  s.resolve(a.id, 'accepted');
  assert.equal(s.pending(), undefined);
  s.promote(b.id);
  assert.equal(s.get(b.id)?.status, 'awaiting_human');
  assert.equal(s.pending()?.id, b.id);
  s.resolve(b.id, 'accepted');
  assert.equal((await wb)?.status, 'accepted');
});

test('dismiss with reason; dismissing a queued step works without promotion', async () => {
  const s = new ProposalStore();
  const q = s.propose('later', 'step 2', { queued: true });
  const w = s.wait(q.id, 1000);
  s.resolve(q.id, 'dismissed', 'prior_step_failed');
  const r = await w;
  assert.equal(r?.status, 'dismissed');
  assert.equal(r?.reason, 'prior_step_failed');
});

test('resolve is idempotent; wait on resolved returns immediately; unknown id → null', async () => {
  const s = new ProposalStore();
  const p = s.propose('x');
  s.resolve(p.id, 'accepted');
  s.resolve(p.id, 'dismissed');
  assert.equal(s.get(p.id)?.status, 'accepted');
  assert.equal((await s.wait(p.id, 10))?.status, 'accepted');
  assert.equal(await s.wait('missing', 10), null);
});

test('wait times out with null and honours AbortSignal', async () => {
  const s = new ProposalStore();
  const p = s.propose('slow');
  assert.equal(await s.wait(p.id, 20), null);
  const ac = new AbortController();
  const w = s.wait(p.id, 5000, ac.signal);
  ac.abort();
  assert.equal(await w, null);
  assert.equal(s.get(p.id)?.status, 'awaiting_human');
});

test('dangerous flag and invocation metadata are carried', () => {
  const s = new ProposalStore();
  const p = s.propose('rm -rf /', 'careful', { dangerous: true, invocation_id: 'inv9', step: 2 });
  assert.equal(p.dangerous, true);
  assert.equal(p.invocation_id, 'inv9');
  assert.equal(p.step, 2);
});

test('subscribe fires on every transition', () => {
  const s = new ProposalStore();
  let n = 0;
  const off = s.subscribe(() => n++);
  const p = s.propose('a');
  s.promote(p.id); // no-op: already awaiting → no emit
  s.resolve(p.id, 'dismissed');
  off();
  s.propose('b');
  assert.equal(n, 2);
});
