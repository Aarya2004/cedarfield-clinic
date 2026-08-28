// Run: node --experimental-strip-types --test src/lib/terminal/terminal-adapter.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTerminalAdapter, type ClientLike, type TermLike } from './adapter.ts';
import { ProposalStore } from '../webmcp/proposals.ts';
import type { BridgeStatus } from '../ws/protocol.ts';

const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);

function fakeTerm(lines: string[], wrapped: number[] = []): TermLike {
  return { buffer: { active: { length: lines.length, cursorX: 4, cursorY: lines.length - 1, baseY: 0, getLine: (y) => ({ translateToString: (trim?: boolean) => (trim ? (lines[y] ?? '').replace(/\s+$/, '') : lines[y] ?? ''), isWrapped: wrapped.includes(y) }) } } };
}

function fakeClient() {
  const handlers: Record<string, Set<(v: never) => void>> = { data: new Set(), status: new Set(), state: new Set() };
  const sent: string[] = [];
  let paired = true;
  const client: ClientLike & { emit: (ev: string, v: unknown) => void; sent: string[]; setPaired: (b: boolean) => void; lastStatus: BridgeStatus | null } = {
    get paired() {
      return paired;
    },
    hello: { type: 'hello', mode: 'builder', shell: 'zsh', cwd: '/h', pid: 1, session_id: 's', version: 1, integration: true },
    lastStatus: null,
    sendInput: (d) => {
      if (!paired) return false;
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
    setPaired: (b) => (paired = b),
  };
  return client;
}

const status = (o: Partial<BridgeStatus>): BridgeStatus => ({ cwd: '/h', running: false, last_exit_code: 0, last_command_ms: 0, last_command: null, ...o });

test('screenLines: last n lines, trailing blanks dropped, order preserved', () => {
  const a = createTerminalAdapter({ term: fakeTerm(['~ $ ls', 'a  b', '~ $ ', '', '']), client: fakeClient(), share: () => true, store: new ProposalStore() });
  assert.deepEqual(a.screenLines(10), ['~ $ ls', 'a  b', '~ $']); // trimmed right, as xterm's translateToString(true) does
  assert.deepEqual(a.screenLines(2), ['a  b', '~ $']);
});

test('status: null unless paired; integration from hello', () => {
  const c = fakeClient();
  const a = createTerminalAdapter({ term: fakeTerm([]), client: c, share: () => false, store: new ProposalStore() });
  assert.equal(a.status(), null);
  c.emit('status', status({ last_exit_code: 3 }));
  assert.equal(a.status()?.last_exit_code, 3);
  assert.equal(a.status()?.integration, true);
  c.setPaired(false);
  assert.equal(a.status(), null);
});

test('Enter sends command+CR once; end marker → exit_code/ms/tail; waitProposal returns it (and again later)', async () => {
  const store = new ProposalStore();
  const c = fakeClient();
  const a = createTerminalAdapter({ term: fakeTerm([]), client: c, share: () => true, store });
  const p = store.propose('echo hi; false', 'why');
  const w = a.waitProposal(p.id, 1000);
  assert.equal(a.acceptProposal(p.id), true);
  assert.deepEqual(c.sent, ['echo hi; false\r']);
  assert.equal(store.get(p.id)?.status, 'accepted');
  assert.equal(a.acceptProposal(p.id), false);
  assert.equal(a.inFlight(), p.id);
  // shell echoes the line, marks start, prints output; the bridge sends the data frame carrying
  // the end marker (and the last output line) BEFORE the status frame
  c.emit('data', `echo hi; false\r\n${ESC}]133;C${BEL}`);
  c.emit('data', `hi\r\n`);
  c.emit('data', `${ESC}[31mred${ESC}[0m\r\n${ESC}]133;D;1${BEL}`);
  c.emit('status', status({ running: false, last_exit_code: 1, last_command_ms: 7, last_command: 'echo hi; false' }));
  const r = await w;
  assert.equal(r?.status, 'accepted');
  assert.equal(r?.exit_code, 1);
  assert.equal(r?.ms, 7);
  assert.deepEqual(r?.tail, ['echo hi; false', 'hi', 'red']);
  assert.equal(a.inFlight(), null);
  assert.equal((await a.waitProposal(p.id, 10))?.exit_code, 1);
});

test('a status with running:false BEFORE the start marker is ignored (previous command)', async () => {
  const store = new ProposalStore();
  const c = fakeClient();
  const a = createTerminalAdapter({ term: fakeTerm([]), client: c, share: () => true, store });
  const p = store.propose('sleep 1');
  a.acceptProposal(p.id);
  c.emit('status', status({ running: false, last_exit_code: 9, last_command: 'old' }));
  assert.equal(await a.waitProposal(p.id, 15), null); // still in flight
  c.emit('data', `${ESC}]133;C${BEL}`);
  c.emit('status', status({ running: false, last_exit_code: 0, last_command_ms: 1000, last_command: 'sleep 1' }));
  assert.equal(await a.waitProposal(p.id, 15), null); // end status alone is not enough: the D-marker data is still to come
  c.emit('data', `${ESC}]133;D;0${BEL}`);
  assert.equal((await a.waitProposal(p.id, 15))?.exit_code, 0);
});

test('regression (Fable pass 2 F1): output sharing a frame with the end marker is in the tail, whichever order status and data arrive', async () => {
  for (const statusFirst of [false, true]) {
    const store = new ProposalStore();
    const c = fakeClient();
    const a = createTerminalAdapter({ term: fakeTerm([]), client: c, share: () => true, store });
    const p = store.propose('echo 1; echo 2; echo 3');
    const w = a.waitProposal(p.id, 1000);
    a.acceptProposal(p.id);
    c.emit('data', `echo 1; echo 2; echo 3\r\n${ESC}]133;C${BEL}1\r\n`);
    const st = status({ running: false, last_exit_code: 0, last_command_ms: 3, last_command: 'echo 1; echo 2; echo 3' });
    if (statusFirst) c.emit('status', st);
    c.emit('data', `2\r\n3\r\n${ESC}]133;D;0${BEL}${ESC}]133;A${BEL}$ `);
    if (!statusFirst) c.emit('status', st);
    const r = await w;
    assert.deepEqual(r?.tail, ['echo 1; echo 2; echo 3', '1', '2', '3', '$ '], `statusFirst=${statusFirst}`);
    assert.equal(r?.exit_code, 0);
    a.destroy();
  }
});

test('regression (Fable pass 2 F2): while the bridge reports running:true, Enter on a ghost is refused and nothing is sent', async () => {
  const store = new ProposalStore();
  const c = fakeClient();
  const a = createTerminalAdapter({ term: fakeTerm([]), client: c, share: () => true, store });
  c.emit('status', status({ running: true, last_command: 'cat' }));
  const p = store.propose('echo PROPOSAL_WENT_TO_CAT');
  assert.equal(a.acceptProposal(p.id), false);
  assert.deepEqual(c.sent, []);
  assert.equal(store.get(p.id)?.status, 'awaiting_human');
  c.emit('data', `${ESC}]133;D;0${BEL}${ESC}]133;A${BEL}`);
  c.emit('status', status({ running: false, last_command: 'cat' }));
  assert.equal(a.acceptProposal(p.id), true);
  assert.deepEqual(c.sent, ['echo PROPOSAL_WENT_TO_CAT\r']);
  a.destroy();
});

test('regression (Fable pass 2 F3): Tab-insert → Ctrl-U → Enter (prompt returns without 133;C) resolves unmeasured; adapter is not wedged', async () => {
  const store = new ProposalStore();
  const c = fakeClient();
  const a = createTerminalAdapter({ term: fakeTerm([]), client: c, share: () => true, store });
  const p = store.propose('ls');
  const w = a.waitProposal(p.id, 1000);
  a.acceptProposal(p.id, { edited: true, alreadySent: true });
  c.emit('data', `\r\n${ESC}]133;A${BEL}$ `); // zsh: precmd only, nothing ran
  const r = await w;
  assert.equal(r?.status, 'accepted');
  assert.equal(r?.exit_code, null);
  assert.equal(r?.measured, false);
  assert.equal(a.inFlight(), null);
  const q = store.propose('pwd');
  assert.equal(a.acceptProposal(q.id), true);
  a.destroy();
});

test('regression (Fable pass 2 F3): without integration a second Enter closes the first proposal unmeasured instead of refusing', async () => {
  const store = new ProposalStore();
  const c = fakeClient();
  Object.assign(c, { hello: { ...c.hello!, shell: 'bash', integration: false } });
  const a = createTerminalAdapter({ term: fakeTerm([]), client: c, share: () => true, store, quietMs: 10_000 });
  const p = store.propose('sleep 5');
  const w = a.waitProposal(p.id, 1000);
  assert.equal(a.acceptProposal(p.id), true);
  const q = store.propose('ls');
  assert.equal(a.acceptProposal(q.id), true);
  const r = await w;
  assert.equal(r?.measured, false);
  assert.equal(a.inFlight(), q.id);
  assert.deepEqual(c.sent, ['sleep 5\r', 'ls\r']);
  a.destroy();
});

test('Esc resolves waitProposal with dismissed; abort → null; unknown → null', async () => {
  const store = new ProposalStore();
  const a = createTerminalAdapter({ term: fakeTerm([]), client: fakeClient(), share: () => true, store });
  const p = store.propose('ls');
  const w = a.waitProposal(p.id, 1000);
  store.resolve(p.id, 'dismissed');
  assert.equal((await w)?.status, 'dismissed');
  const q = store.propose('ls');
  const ac = new AbortController();
  const w2 = a.waitProposal(q.id, 1000, ac.signal);
  ac.abort();
  assert.equal(await w2, null);
  assert.equal(await a.waitProposal('nope', 10), null);
});

test('disconnect mid-command → interrupted with partial tail; Tab-insert path marks edited and sends nothing', async () => {
  const store = new ProposalStore();
  const c = fakeClient();
  const a = createTerminalAdapter({ term: fakeTerm([]), client: c, share: () => true, store });
  const p = store.propose('long');
  const w = a.waitProposal(p.id, 1000);
  a.acceptProposal(p.id, { edited: true, alreadySent: true });
  assert.deepEqual(c.sent, []);
  c.emit('data', `${ESC}]133;C${BEL}partial\r\n`);
  c.emit('state', 'disconnected');
  const r = await w;
  assert.equal(r?.interrupted, true);
  assert.equal(r?.edited, true);
  assert.equal(r?.exit_code, null);
  assert.deepEqual(r?.tail, ['partial']);
});

test('tail is capped at TAIL_MAX_LINES', async () => {
  const store = new ProposalStore();
  const c = fakeClient();
  const a = createTerminalAdapter({ term: fakeTerm([]), client: c, share: () => true, store });
  const p = store.propose('yes');
  a.acceptProposal(p.id);
  c.emit('data', `${ESC}]133;C${BEL}`);
  for (let i = 0; i < 300; i++) c.emit('data', `line ${i}\r\n`);
  c.emit('data', `${ESC}]133;D;0${BEL}`);
  c.emit('status', status({ last_command: 'yes' }));
  const r = await a.waitProposal(p.id, 10);
  assert.equal(r?.tail?.length, 200);
});

test('regression (Opus pass 2 P1): no shell integration → completes on output silence, unmeasured; next proposal not wedged', async () => {
  const c = fakeClient();
  Object.assign(c, { hello: { ...c.hello!, shell: 'bash', integration: false } });
  const store = new ProposalStore();
  const a = createTerminalAdapter({ term: fakeTerm([]), client: c, share: () => true, store, quietMs: 20 });
  const { id } = a.ghostType('echo probe_marker; false', 'probe');
  assert.equal(a.acceptProposal(id), true);
  assert.equal(c.sent.at(-1), 'echo probe_marker; false\r');
  const wait = a.waitProposal(id, 2000);
  // bash emits no OSC 133 markers and no status frames — only raw output
  c.emit('data', 'echo probe_marker; false\r\nprobe_');
  c.emit('data', 'marker\r\n$ ');
  const r = await wait;
  assert.ok(r);
  assert.equal(r.status, 'accepted');
  assert.equal(r.exit_code, null);
  assert.equal(r.ms, null);
  assert.equal(r.measured, false);
  assert.deepEqual(r.tail, ['echo probe_marker; false', 'probe_marker', '$ ']);
  assert.equal(a.inFlight(), null);
  const second = a.ghostType('ls', 'next');
  assert.equal(a.acceptProposal(second.id), true, 'second proposal must not be refused');
  a.destroy();
});

test('with integration, output silence never finishes a command (only the status frame does)', async () => {
  const c = fakeClient();
  const store = new ProposalStore();
  const a = createTerminalAdapter({ term: fakeTerm([]), client: c, share: () => true, store, quietMs: 10 });
  const { id } = a.ghostType('sleep 1', 'zsh path');
  a.acceptProposal(id);
  c.emit('data', ESC + ']133;C' + BEL);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(a.inFlight(), id);
  c.emit('data', `${ESC}]133;D;0${BEL}`);
  c.emit('status', status({ running: false, last_exit_code: 0, last_command_ms: 1000 }));
  assert.equal((await a.waitProposal(id, 100))?.ms, 1000);
  a.destroy();
});

test('rokan-do trailer parsed by the bridge rides along on the resolved proposal', async () => {
  const store = new ProposalStore();
  const c = fakeClient();
  const a = createTerminalAdapter({ term: fakeTerm([]), client: c, share: () => true, store });
  const p = store.propose('rokan do "what is the current status at githubstatus.com"');
  const w = a.waitProposal(p.id, 1000);
  a.acceptProposal(p.id);
  c.emit('data', `${ESC}]133;C${BEL}  All Systems Operational   312ms  ⚡\r\n${ESC}]133;D;0${BEL}`);
  c.emit('status', status({ last_exit_code: 0, last_command_ms: 400, last_rokan: { ms: 312, replayed: true } }));
  const r = await w;
  assert.deepEqual(r?.rokan, { ms: 312, replayed: true });
  assert.equal(a.status()?.last_rokan?.replayed, true);
  a.destroy();
});

test('regression (judge mode, 2026-08-28): wrapped rows are joined into logical lines so a KEY=value split by wrapping is redactable', () => {
  // 30-col terminal: the export line wraps; row 2 is a continuation (isWrapped)
  const rows = ['judge@rokan:/tmp/demo % export ', 'AWS_SECRET_ACCESS_KEY=wJalrXUtnF', 'EMI/K7MDENG/bPxRfiCYEXAMPLEKEY', 'marker_ok', 'judge@rokan:/tmp/demo % ', ''];
  const a = createTerminalAdapter({ term: fakeTerm(rows, [1, 2]), client: fakeClient(), share: () => true, store: new ProposalStore() });
  assert.deepEqual(a.screenLines(10), ['judge@rokan:/tmp/demo % export AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', 'marker_ok', 'judge@rokan:/tmp/demo %']);
  assert.deepEqual(a.screenLines(1), ['judge@rokan:/tmp/demo %']);
});
