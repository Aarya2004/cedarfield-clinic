// Run: node --experimental-strip-types --test src/lib/terminal/terminal-adapter.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTerminalAdapter, type ClientLike, type TermLike } from './adapter.ts';
import { ProposalStore } from '../webmcp/proposals.ts';
import type { BridgeStatus } from '../ws/protocol.ts';

const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);

function fakeTerm(lines: string[]): TermLike {
  return { buffer: { active: { length: lines.length, cursorX: 4, cursorY: lines.length - 1, baseY: 0, getLine: (y) => ({ translateToString: () => lines[y] ?? '' }) } } };
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
  assert.deepEqual(a.screenLines(10), ['~ $ ls', 'a  b', '~ $ ']);
  assert.deepEqual(a.screenLines(2), ['a  b', '~ $ ']);
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
  // shell echoes the line, marks start, prints output, then bridge sends status (before the D-marker data)
  c.emit('data', `echo hi; false\r\n${ESC}]133;C${BEL}`);
  c.emit('data', `hi\r\n`);
  c.emit('data', `${ESC}[31mred${ESC}[0m\r\n`);
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
  assert.equal((await a.waitProposal(p.id, 15))?.exit_code, 0);
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
  c.emit('status', status({ last_command: 'yes' }));
  const r = await a.waitProposal(p.id, 10);
  assert.equal(r?.tail?.length, 200);
});
