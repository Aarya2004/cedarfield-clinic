// Run: node --experimental-strip-types --test src/lib/webmcp/forge.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLIENT_LEDGER_KINDS } from '../ws/protocol.ts';
import { ForgeEngine } from './forge.ts';
import { ProposalStore } from './proposals.ts';
import { Ledger } from './ledger.ts';
import type { ModelContext, ModelContextTool, RegisterToolOptions } from './types.ts';
import type { TerminalAdapter, ResolvedProposal } from './adapter.ts';
import type { ForgeSpec } from './forge-spec.ts';

interface Reg {
  tool: ModelContextTool<unknown>;
  signal?: AbortSignal;
}

function fakeMc() {
  const regs: Reg[] = [];
  const mc = {
    registerTool: async (tool: ModelContextTool<unknown>, options?: RegisterToolOptions) => {
      regs.push({ tool, signal: options?.signal });
    },
    getTools: async () => regs.filter((r) => !r.signal?.aborted).map((r) => ({ name: r.tool.name, description: r.tool.description, origin: 'test' })),
    ontoolchange: null,
  } as unknown as ModelContext;
  return { mc, regs, live: () => regs.filter((r) => !r.signal?.aborted).map((r) => r.tool.name) };
}

function fakeAdapter(store: ProposalStore) {
  const exits = new Map<string, { exit_code: number | null; ms: number | null }>();
  const adapter: TerminalAdapter = {
    mode: 'builder',
    shareScreen: () => false,
    screenLines: () => [],
    status: () => null,
    ghostType: (command, why, opts) => store.propose(command, why, opts),
    waitProposal: async (id, ms, signal) => {
      const p = await store.wait(id, ms, signal);
      if (!p) return null;
      const r: ResolvedProposal = { ...p, ...(exits.get(id) ?? { exit_code: 0, ms: 12 }) };
      return r;
    },
  };
  return { adapter, exits };
}

function make(opts: { mc?: ModelContext | null; stepTimeoutMs?: number } = {}) {
  const store = new ProposalStore();
  const { mc, regs, live } = fakeMc();
  const { adapter, exits } = fakeAdapter(store);
  const ledger = new Ledger();
  const engine = new ForgeEngine({ modelContext: () => (opts.mc === undefined ? mc : opts.mc), adapter: () => adapter, store, ledger, stepTimeoutMs: opts.stepTimeoutMs });
  return { engine, store, regs, live, exits, ledger };
}

const hn: ForgeSpec = {
  name: 'hn_top',
  description: 'Top N Hacker News titles via rokan do.',
  commands: ['rokan do "top {{n}} HN titles"'],
  params: [{ name: 'n', description: 'How many titles', example: '5' }],
  kind: 'read',
};

const tick = () => new Promise((r) => setTimeout(r, 5));

function card(engine: ForgeEngine, spec: ForgeSpec, origin: 'agent' | 'human' = 'agent') {
  const c = engine.openCard(spec, { origin });
  if ('error' in c) throw new Error(JSON.stringify(c));
  return c;
}

test('openCard: valid, invalid, pending cap', () => {
  const { engine } = make();
  const c = card(engine, hn);
  assert.equal(c.spec.name, 'hn_top');
  assert.equal(c.dangerous, false);
  assert.equal(c.kindOverridden, false);
  assert.equal(engine.openCard({ ...hn, name: 'X' }, { origin: 'agent' }).hasOwnProperty('error'), true);
  for (let i = 0; i < 4; i++) card(engine, { ...hn, name: `t${i}` });
  const sixth = engine.openCard({ ...hn, name: 't9' }, { origin: 'agent' });
  assert.equal('error' in sixth ? sixth.error : null, 'too_many_pending');
});

test('kind: agent-declared read on a mutating command is overridden to write', () => {
  const { engine } = make();
  const c = card(engine, { ...hn, commands: ['rm -rf {{n}}'], kind: 'read' });
  assert.equal(c.kindOverridden, true);
  assert.equal(c.spec.kind, 'write');
  assert.equal(c.dangerous, false);
});

test('dangerous needs confirmation, then registers with CONSEQUENTIAL description', async () => {
  const { engine, regs } = make();
  const c = card(engine, { ...hn, name: 'nuke', commands: ['rm -rf / {{n}}'], kind: 'write' });
  assert.equal(c.dangerous, true);
  const r1 = await engine.approve(c.card_id);
  assert.equal('error' in r1 ? r1.error : null, 'needs_confirmation');
  const r2 = await engine.approve(c.card_id, undefined, { confirmDangerous: true });
  assert.equal('error' in r2, false);
  assert.ok(regs[0].tool.description.startsWith('CONSEQUENTIAL: '));
  assert.equal(regs[0].tool.annotations?.readOnlyHint, false);
});

test('approve registers forged_<name> with schema, readOnlyHint, live signal; card removed; ledger row', async () => {
  const { engine, regs, live, ledger } = make();
  const c = card(engine, hn);
  const t = await engine.approve(c.card_id);
  if ('error' in t) throw new Error(t.error);
  assert.equal(t.tool, 'forged_hn_top');
  assert.equal(t.visible, true);
  assert.equal(t.registered, true);
  assert.equal(t.hash.length, 12);
  assert.deepEqual(live(), ['forged_hn_top']);
  const reg = regs[0].tool;
  assert.equal(reg.annotations?.readOnlyHint, true);
  assert.deepEqual((reg.inputSchema as { required: string[] }).required, ['n']);
  assert.ok(reg.description.length <= 500);
  assert.equal(engine.cards().length, 0);
  await tick();
  assert.ok(ledger.snapshot().some((r) => r.kind === 'forged' && r.fields.hash === t.hash));
});

test('approve with edits re-validates; bad edit leaves the card', async () => {
  const { engine } = make();
  const c = card(engine, hn);
  const bad = await engine.approve(c.card_id, { name: 'Bad Name' });
  assert.equal('error' in bad ? bad.error : null, 'invalid_name');
  assert.equal(engine.cards().length, 1);
  const good = await engine.approve(c.card_id, { description: 'edited' });
  assert.equal('error' in good, false);
  assert.equal(engine.tool('hn_top')?.spec.description, 'edited');
});

test('reject removes the card', () => {
  const { engine } = make();
  const c = card(engine, hn);
  assert.deepEqual(engine.reject(c.card_id), { ok: true });
  assert.equal(engine.cards().length, 0);
  assert.equal(engine.reject(c.card_id).hasOwnProperty('error'), true);
});

test('re-forge same name: old signal aborted, new hash, previousHash on card', async () => {
  const { engine, regs, live } = make();
  const t1 = await engine.approve(card(engine, hn).card_id);
  if ('error' in t1) throw new Error(t1.error);
  const c2 = card(engine, { ...hn, description: 'changed' });
  assert.equal(c2.previousHash, t1.hash);
  const t2 = await engine.approve(c2.card_id);
  if ('error' in t2) throw new Error(t2.error);
  assert.notEqual(t2.hash, t1.hash);
  assert.equal(regs[0].signal?.aborted, true);
  assert.equal(regs[1].signal?.aborted, false);
  assert.deepEqual(live(), ['forged_hn_top']);
  assert.equal(engine.tools().length, 1);
});

test('budget: 6th forge evicts the oldest unpinned; pinned survives; all pinned → unpin_one; restore works', async () => {
  const { engine, live } = make();
  for (let i = 1; i <= 6; i++) {
    const t = await engine.approve(card(engine, { ...hn, name: `t${i}` }).card_id);
    if ('error' in t) throw new Error(t.error);
    await tick();
  }
  assert.equal(engine.visibleCount(), 5);
  assert.equal(engine.tool('t1')?.visible, false);
  assert.deepEqual(live(), ['forged_t2', 'forged_t3', 'forged_t4', 'forged_t5', 'forged_t6']);
  assert.equal(engine.list().tools.find((t) => t.name === 't1')?.visible, false);

  engine.pin('t2', true);
  const t7 = await engine.approve(card(engine, { ...hn, name: 't7' }).card_id);
  assert.equal('error' in t7, false);
  assert.equal(engine.tool('t2')?.visible, true);
  assert.equal(engine.tool('t3')?.visible, false);

  for (const n of ['t4', 't5', 't6', 't7']) engine.pin(n, true);
  const t8 = await engine.approve(card(engine, { ...hn, name: 't8' }).card_id);
  assert.equal('error' in t8 ? t8.error : null, 'unpin_one');
  assert.equal(engine.cards().length, 1);

  const r = await engine.restore('t1');
  assert.equal('error' in r ? r.error : null, 'unpin_one');
  engine.pin('t7', false);
  const r2 = await engine.restore('t1');
  if ('error' in r2) throw new Error(r2.error);
  assert.equal(r2.visible, true);
  assert.equal(engine.tool('t7')?.visible, false);
  assert.equal(engine.visibleCount(), 5);
});

test('invoke: substitution, one ghost-typed + queued steps, Enter/Enter/Esc, stats, ledger', async () => {
  const { engine, store, ledger } = make();
  const spec: ForgeSpec = {
    ...hn,
    name: 'deploy',
    commands: ['pnpm build', 'pnpm test -- {{filter}}', 'netlify deploy --prod'],
    params: [{ name: 'filter', description: 'test filter', example: 'unit' }],
    kind: 'write',
  };
  const t = await engine.approve(card(engine, spec).card_id);
  if ('error' in t) throw new Error(t.error);
  const r = engine.invoke('deploy', { filter: 'a b' });
  if ('error' in r || 'status' in r) throw new Error(JSON.stringify(r));
  assert.equal(r.proposal_ids.length, 3);
  assert.equal(r.queued, 2);
  assert.equal(r.active, r.proposal_ids[0]);
  assert.equal(store.pending()?.id, r.proposal_ids[0]);
  assert.equal(store.get(r.proposal_ids[1])?.command, "pnpm test -- 'a b'");
  assert.equal(store.get(r.proposal_ids[1])?.status, 'queued');
  assert.equal(engine.active()?.invocation_id, r.invocation_id);

  const busy = engine.invoke('deploy', { filter: 'x' });
  assert.equal('status' in busy ? busy.status : null, 'busy');

  store.resolve(r.proposal_ids[0], 'accepted');
  await tick();
  assert.equal(store.pending()?.id, r.proposal_ids[1]);
  store.resolve(r.proposal_ids[1], 'accepted');
  await tick();
  assert.equal(store.pending()?.id, r.proposal_ids[2]);
  store.resolve(r.proposal_ids[2], 'dismissed');
  await tick();
  assert.equal(engine.active(), null);
  const l = engine.list().tools[0];
  assert.equal(l.runs, 1);
  assert.equal(l.last_exit, 0);
  assert.equal(l.median_ms, null); // final step was dismissed → no final-step ms
  const kinds = ledger.snapshot().map((x) => x.kind);
  assert.ok(kinds.includes('invoked'));
  assert.equal(kinds.filter((k) => k === 'executed_step').length, 2);
  // regression (Opus pass 2 P1): every client-produced kind must be one the bridge countersigns
  for (const k of kinds) assert.ok(CLIENT_LEDGER_KINDS.has(k), `bridge would drop kind ${k}`);
  assert.ok(kinds.includes('dismissed'));
});

test('invoke: non-zero exit dismisses the remaining steps with prior_step_failed', async () => {
  const { engine, store, exits } = make();
  const spec: ForgeSpec = { ...hn, name: 'two', commands: ['false', 'echo never'], params: [], kind: 'read' };
  await engine.approve(card(engine, spec).card_id);
  const r = engine.invoke('two', {});
  if ('error' in r || 'status' in r) throw new Error(JSON.stringify(r));
  exits.set(r.proposal_ids[0], { exit_code: 1, ms: 40 });
  store.resolve(r.proposal_ids[0], 'accepted');
  await tick();
  assert.equal(store.get(r.proposal_ids[1])?.status, 'dismissed');
  assert.equal(store.get(r.proposal_ids[1])?.reason, 'prior_step_failed');
  assert.equal(engine.active(), null);
  assert.equal(engine.list().tools[0].last_exit, 1);
});

test('invoke: happy single step records median_ms; second run updates stats', async () => {
  const { engine, store, exits } = make();
  await engine.approve(card(engine, hn).card_id);
  for (const ms of [30, 10]) {
    const r = engine.invoke('hn_top', { n: 3 });
    if ('error' in r || 'status' in r) throw new Error(JSON.stringify(r));
    assert.equal(store.get(r.proposal_ids[0])?.command, 'rokan do "top 3 HN titles"');
    exits.set(r.proposal_ids[0], { exit_code: 0, ms });
    store.resolve(r.proposal_ids[0], 'accepted');
    await tick();
  }
  const l = engine.list().tools[0];
  assert.equal(l.runs, 2);
  assert.equal(l.median_ms, 20);
  assert.equal(l.last_exit, 0);
});

test('invoke errors: unknown_tool, invalid_param, unregistered after eviction/unforge', async () => {
  const { engine } = make();
  assert.equal((engine.invoke('nope', {}) as { error: string }).error, 'unknown_tool');
  await engine.approve(card(engine, hn).card_id);
  assert.equal((engine.invoke('hn_top', {}) as { error: string }).error, 'invalid_param');
  assert.equal((engine.invoke('hn_top', { n: 'a\nb' }) as { error: string }).error, 'invalid_param');
  engine.unforge('hn_top');
  assert.equal((engine.invoke('hn_top', { n: 1 }) as { error: string }).error, 'unknown_tool');
});

test('step timeout dismisses with step_timeout and frees the engine', async () => {
  const { engine, store } = make({ stepTimeoutMs: 15 });
  await engine.approve(card(engine, hn).card_id);
  const r = engine.invoke('hn_top', { n: 1 });
  if ('error' in r || 'status' in r) throw new Error(JSON.stringify(r));
  await new Promise((res) => setTimeout(res, 40));
  assert.equal(store.get(r.proposal_ids[0])?.status, 'dismissed');
  assert.equal(store.get(r.proposal_ids[0])?.reason, 'step_timeout');
  assert.equal(engine.active(), null);
});

test('cancelActive + dispose abort everything', async () => {
  const { engine, store, live } = make();
  await engine.approve(card(engine, hn).card_id);
  const r = engine.invoke('hn_top', { n: 1 });
  if ('error' in r || 'status' in r) throw new Error(JSON.stringify(r));
  engine.cancelActive();
  await tick();
  assert.equal(store.get(r.proposal_ids[0])?.status, 'dismissed');
  assert.equal(engine.active(), null);
  engine.dispose();
  assert.deepEqual(live(), []);
  assert.equal(engine.tool('hn_top')?.visible, false);
});

test('no modelContext: tools are tracked, not registered; invoke still works in-page', async () => {
  const { engine, store } = make({ mc: null });
  const t = await engine.approve(card(engine, hn).card_id);
  if ('error' in t) throw new Error(t.error);
  assert.equal(t.registered, false);
  assert.equal(t.visible, true);
  const r = engine.invoke('hn_top', { n: 2 });
  if ('error' in r || 'status' in r) throw new Error(JSON.stringify(r));
  assert.equal(store.pending()?.command, 'rokan do "top 2 HN titles"');
  engine.cancelActive();
});

test('registered execute() routes to invoke and rejects after abort', async () => {
  const { engine, regs, store } = make();
  await engine.approve(card(engine, hn).card_id);
  const out = (await regs[0].tool.execute({ n: 4 }, { signal: new AbortController().signal })) as { proposal_ids: string[] };
  assert.equal(out.proposal_ids.length, 1);
  assert.equal(store.pending()?.command, 'rokan do "top 4 HN titles"');
  engine.cancelActive();
  await tick();
  const asString = (await regs[0].tool.execute('{"n":"7"}', { signal: new AbortController().signal })) as { proposal_ids: string[] };
  assert.equal(asString.proposal_ids.length, 1);
  engine.cancelActive();
  await tick();
  engine.unforge('hn_top');
  const dead = (await regs[0].tool.execute({ n: 1 }, { signal: new AbortController().signal })) as { error: string };
  assert.equal(dead.error, 'unregistered');
});

test('regression (Fable pass 1 P2): unforging the tool whose invocation is active cancels it — nothing stays busy', async () => {
  const { engine, store } = make();
  const spec: ForgeSpec = { ...hn, name: 'two', commands: ['echo a', 'echo b'], params: [], kind: 'read' };
  await engine.approve(card(engine, spec).card_id);
  const r = engine.invoke('two', {});
  if ('error' in r || 'status' in r) throw new Error(JSON.stringify(r));
  assert.equal(engine.active()?.invocation_id, r.invocation_id);
  assert.deepEqual(engine.unforge('two'), { ok: true });
  await tick();
  assert.equal(engine.active(), null);
  assert.equal(store.pending(), undefined);
  assert.equal(store.get(r.proposal_ids[0])?.status, 'dismissed');
  await engine.approve(card(engine, hn).card_id);
  const again = engine.invoke('hn_top', { n: '1' });
  assert.ok(!('status' in again && again.status === 'busy'), 'engine stayed busy after unforge');
  engine.dispose(); // never leave an invocation (and its step timer) alive after the test
});
