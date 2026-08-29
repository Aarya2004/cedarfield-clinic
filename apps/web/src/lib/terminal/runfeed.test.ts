// Run: node --experimental-strip-types --test src/lib/terminal/runfeed.test.ts
//
// The streams below are the real bytes zsh's shell integration prints (see
// packages/bridge/src/shell-integration.js): preexec emits OSC 7331;cmd;<base64> then OSC 133;C,
// precmd emits OSC 7 (cwd), OSC 133;D;<code> and OSC 133;A. Nothing is captured unless those
// markers arrive, so a shell without integration can never produce a phantom record.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTerminalAdapter, type ClientLike, type TermLike } from './adapter.ts';
import { PromptDetector } from './osc.ts';
import { RunFeedStore, RUN_FEED_MAX, matchesFilter, runFromResolved, type Run } from './runfeed.ts';
import { ProposalStore } from '../webmcp/proposals.ts';
import type { BridgeStatus } from '../ws/protocol.ts';

const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);
const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
/** exactly what __rokan_preexec prints */
const preexec = (cmd: string) => `${ESC}]7331;cmd;${b64(cmd)}${BEL}${ESC}]133;C${BEL}`;
/** exactly what __rokan_precmd prints */
const precmd = (code: number, cwd = '/home/dev') => `${ESC}]7;file://host${cwd}${BEL}${ESC}]133;D;${code}${BEL}${ESC}]133;A${BEL}`;

function fakeTerm(): TermLike {
  return { buffer: { active: { length: 0, cursorX: 0, cursorY: 0, baseY: 0, getLine: () => undefined } } };
}

function fakeClient(integration = true) {
  const handlers: Record<string, Set<(v: never) => void>> = { data: new Set(), status: new Set(), state: new Set() };
  const sent: string[] = [];
  const client: ClientLike & { emit: (ev: string, v: unknown) => void; sent: string[]; lastStatus: BridgeStatus | null } = {
    paired: true,
    hello: { type: 'hello', mode: 'builder', shell: integration ? 'zsh' : 'bash', cwd: '/home/dev', pid: 1, session_id: 's', version: 1, integration },
    lastStatus: null,
    sendInput: (d) => {
      sent.push(d);
      return true;
    },
    on: ((ev: string, fn: (v: never) => void) => {
      handlers[ev].add(fn);
      return () => handlers[ev].delete(fn);
    }) as ClientLike['on'],
    emit: (ev, v) => {
      if (ev === 'status') client.lastStatus = v as BridgeStatus;
      handlers[ev].forEach((fn) => (fn as (x: unknown) => void)(v));
    },
    sent,
  };
  return client;
}

const status = (o: Partial<BridgeStatus>): BridgeStatus => ({ cwd: '/home/dev', running: false, last_exit_code: 0, last_command_ms: 0, last_command: null, ...o });

function harness(integration = true) {
  const runs = new RunFeedStore();
  const store = new ProposalStore();
  const c = fakeClient(integration);
  const a = createTerminalAdapter({ term: fakeTerm(), client: c, share: () => true, store, runs, quietMs: 10 });
  return { runs, store, c, a };
}

test('osc: the private 7331;cmd payload becomes a command event, before the start marker', () => {
  const d = new PromptDetector();
  assert.deepEqual(d.feed(preexec('git status --short')), [{ kind: 'command', command: 'git status --short' }, { kind: 'start' }]);
  // UTF-8 survives the base64 round trip, and a split sequence still parses
  const bytes = preexec('echo "héllo ⚡"');
  const cut = 6;
  assert.deepEqual([...d.feed(bytes.slice(0, cut)), ...d.feed(bytes.slice(cut))], [{ kind: 'command', command: 'echo "héllo ⚡"' }, { kind: 'start' }]);
  // garbage in the payload never throws and never invents a command
  assert.deepEqual(d.feed(`${ESC}]7331;cmd;!!!!not base64!!!!${BEL}`), []);
});

test('osc: existing events are unchanged (prompt/start/end/cwd)', () => {
  const d = new PromptDetector();
  assert.deepEqual(d.feed(precmd(3, '/tmp/x')), [{ kind: 'cwd', cwd: '/tmp/x' }, { kind: 'end', code: 3 }, { kind: 'prompt' }]);
});

test('a human-typed command becomes one run: command, exit, ms, cwd, tail', () => {
  const { runs, c } = harness();
  c.emit('data', precmd(0)); // the shell's first prompt: D with no C — nothing ran
  assert.equal(runs.snapshot().length, 0);
  c.emit('data', preexec('ls -la'));
  c.emit('status', status({ running: true, last_command: 'ls -la' })); // bridge announces the start
  c.emit('data', 'total 8\r\ndrwxr-xr-x  4 dev  staff  128 Aug 29 10:00 .\r\n');
  c.emit('data', precmd(0, '/home/dev/work'));
  c.emit('status', status({ running: false, last_exit_code: 0, last_command_ms: 12, last_command: 'ls -la', cwd: '/home/dev/work' }));
  const [r] = runs.snapshot();
  assert.equal(runs.snapshot().length, 1);
  assert.equal(r.command, 'ls -la');
  assert.equal(r.origin, 'human');
  assert.equal(r.exit_code, 0);
  assert.equal(r.ms, 12);
  assert.equal(r.cwd, '/home/dev/work');
  assert.equal(r.measured, true);
  assert.deepEqual(r.tail, ['total 8', 'drwxr-xr-x  4 dev  staff  128 Aug 29 10:00 .']);
});

test('a failing human command keeps the shell-measured exit code; the rokan trailer rides along', () => {
  const { runs, c } = harness();
  c.emit('data', preexec('rokan do "top 3 HN titles"'));
  c.emit('data', `  Show HN: …   312ms  ⚡\r\n`);
  c.emit('data', precmd(1));
  c.emit('status', status({ last_exit_code: 1, last_command_ms: 400, last_command: 'rokan do "top 3 HN titles"', last_rokan: { ms: 312, replayed: true } }));
  const [r] = runs.snapshot();
  assert.equal(r.exit_code, 1);
  assert.deepEqual(r.rokan, { ms: 312, replayed: true });
  assert.equal(matchesFilter(r, 'failures'), true);
  assert.equal(matchesFilter(r, 'rokan'), true);
  assert.equal(matchesFilter(r, 'forged'), false);
});

test('the status frame may arrive before the data frame carrying 133;D (either order, one run)', () => {
  for (const statusFirst of [false, true]) {
    const { runs, c } = harness();
    c.emit('data', preexec('echo hi'));
    const st = status({ last_exit_code: 0, last_command_ms: 5, last_command: 'echo hi' });
    if (statusFirst) c.emit('status', st);
    c.emit('data', `hi\r\n${precmd(0)}`);
    if (!statusFirst) c.emit('status', st);
    assert.equal(runs.snapshot().length, 1, `statusFirst=${statusFirst}`);
    assert.equal(runs.snapshot()[0].ms, 5);
    assert.deepEqual(runs.snapshot()[0].tail, ['hi']);
  }
});

test('an accepted proposal produces exactly one run (the resolution), never a second human one', async () => {
  const { runs, store, c, a } = harness();
  const p = store.propose('git status', 'see the tree');
  assert.equal(a.acceptProposal(p.id), true);
  // the same markers the human's own command would print — they belong to the proposal
  c.emit('data', `git status\r\n${preexec('git status')}`);
  c.emit('data', `nothing to commit\r\n${precmd(0)}`);
  c.emit('status', status({ last_exit_code: 0, last_command_ms: 21, last_command: 'git status' }));
  const resolved = await a.waitProposal(p.id, 100);
  assert.equal(resolved?.exit_code, 0);
  const snap = runs.snapshot();
  assert.equal(snap.length, 1);
  assert.equal(snap[0].id, p.id);
  assert.equal(snap[0].origin, 'agent');
  assert.equal(snap[0].ms, 21);
  assert.deepEqual(snap[0].tail, ['git status', 'nothing to commit']);
  // a repeated resolution (a second subscriber recording the same one) is ignored, not duplicated
  runs.record(runFromResolved({ ...resolved!, tail: [] }, null));
  assert.equal(runs.snapshot().length, 1);
});

test('the human command that follows a proposal is captured on its own', async () => {
  const { runs, store, c, a } = harness();
  const p = store.propose('ls');
  a.acceptProposal(p.id);
  c.emit('data', preexec('ls'));
  c.emit('data', precmd(0));
  c.emit('status', status({ last_exit_code: 0, last_command_ms: 3, last_command: 'ls' }));
  await a.waitProposal(p.id, 100);
  c.emit('data', preexec('pwd'));
  c.emit('data', `/home/dev\r\n${precmd(0)}`);
  c.emit('status', status({ last_exit_code: 0, last_command_ms: 2, last_command: 'pwd' }));
  assert.deepEqual(
    runs.snapshot().map((r) => [r.origin, r.command]),
    [
      ['agent', 'ls'],
      ['human', 'pwd'],
    ],
  );
});

test("a forged tool's step is recorded as a forged run", async () => {
  const { runs, store, c, a } = harness();
  const p = store.propose('rokan do "top 5 HN titles"', 'forged_hn_top · step 1/1', { invocation_id: 'inv_1', step: 1 });
  a.acceptProposal(p.id);
  c.emit('data', preexec('rokan do "top 5 HN titles"'));
  c.emit('data', precmd(0));
  c.emit('status', status({ last_exit_code: 0, last_command_ms: 900, last_command: 'rokan do "top 5 HN titles"' }));
  await a.waitProposal(p.id, 100);
  assert.equal(runs.snapshot()[0].origin, 'forged');
  assert.equal(matchesFilter(runs.snapshot()[0], 'forged'), true);
});

test('a bare Enter, a Ctrl-U-ed line and the first prompt never invent a run', () => {
  const { runs, c } = harness();
  for (let i = 0; i < 3; i++) {
    c.emit('data', precmd(0)); // precmd with no preexec before it: nothing ran
    c.emit('status', status({ last_exit_code: 0, last_command_ms: null }));
  }
  assert.equal(runs.snapshot().length, 0);
});

test('no shell integration: a stream with no markers produces no human runs at all', async () => {
  const { runs, store, c, a } = harness(false);
  c.emit('data', 'dev@box:~$ ls\r\nfile-a  file-b\r\ndev@box:~$ ');
  assert.equal(runs.snapshot().length, 0);
  // the proposal path still records, honestly unmeasured (the quiet-fallback close)
  const p = store.propose('ls');
  a.acceptProposal(p.id);
  c.emit('data', 'file-a  file-b\r\n');
  await a.waitProposal(p.id, 500);
  const [r] = runs.snapshot();
  assert.equal(runs.snapshot().length, 1);
  assert.equal(r.origin, 'agent');
  assert.equal(r.exit_code, null);
  assert.equal(r.ms, null);
  assert.equal(r.measured, false);
});

test('a disconnect mid-command records what was printed, marked cut short', () => {
  const { runs, c } = harness();
  c.emit('data', preexec('tail -f log'));
  c.emit('data', 'line one\r\n');
  c.emit('state', 'disconnected');
  const [r] = runs.snapshot();
  assert.equal(r.command, 'tail -f log');
  assert.equal(r.interrupted, true);
  assert.equal(r.measured, false);
  assert.equal(r.exit_code, null);
  assert.deepEqual(r.tail, ['line one']);
});

test('the tail is bounded exactly like the proposal tail (200 lines)', () => {
  const { runs, c } = harness();
  c.emit('data', preexec('yes | head -300'));
  for (let i = 0; i < 300; i++) c.emit('data', `line ${i}\r\n`);
  c.emit('data', precmd(0));
  c.emit('status', status({ last_exit_code: 0, last_command_ms: 30 }));
  assert.equal(runs.snapshot()[0].tail.length, 200);
});

test('control characters and bidi overrides never reach the DOM through a command or its tail', () => {
  const runs = new RunFeedStore();
  // \u202e = right-to-left override (it would reverse what a human reads); \u0007 = a raw BEL
  const r = runs.record({ id: 'r1', command: 'echo \u202ednammoc\u0007', origin: 'human', exit_code: 0, ms: 1, cwd: null, tail: ['out\u202eput'], t: 0, measured: true });
  assert.equal(r?.command, 'echo dnammoc');
  assert.deepEqual(r?.tail, ['output']);
});

test('the store is bounded at RUN_FEED_MAX and evicts the oldest first', () => {
  const runs = new RunFeedStore();
  let seen = 0;
  const off = runs.subscribe(() => seen++);
  const make = (i: number): Run => ({ id: `r${i}`, command: `echo ${i}`, origin: 'human', exit_code: 0, ms: 1, cwd: null, tail: [], t: i, measured: true });
  for (let i = 0; i < RUN_FEED_MAX + 25; i++) runs.record(make(i));
  assert.equal(runs.snapshot().length, RUN_FEED_MAX);
  assert.equal(runs.snapshot()[0].id, 'r25');
  assert.equal(runs.snapshot().at(-1)?.id, `r${RUN_FEED_MAX + 24}`);
  assert.equal(seen, RUN_FEED_MAX + 25);
  // an id evicted long ago may be recorded again — the dedupe set does not leak
  assert.notEqual(runs.record(make(0)), null);
  off();
  runs.clear();
  assert.deepEqual(runs.snapshot(), []);
});
