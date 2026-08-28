// Run: node --experimental-strip-types --test src/lib/ws/client.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BridgeClient, type WebSocketLike, NO_HELLO_CLOSE_CODE } from './client.ts';

class FakeSocket implements WebSocketLike {
  static all: FakeSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: ((ev: { code: number; reason: string }) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  url: string;
  constructor(url: string) {
    this.url = url;
    FakeSocket.all.push(this);
  }
  send(d: string) {
    this.sent.push(d);
  }
  close(code = 1000, reason = '') {
    this.readyState = 3;
    this.onclose?.({ code, reason });
  }
  open() {
    this.readyState = 1;
    this.onopen?.(undefined);
  }
  frame(obj: unknown) {
    this.onmessage?.({ data: JSON.stringify(obj) });
  }
  hello() {
    this.frame({ type: 'hello', mode: 'builder', shell: 'zsh', cwd: '/home', pid: 1, session_id: 's', version: 1, integration: true });
  }
  parsed() {
    return this.sent.map((s) => JSON.parse(s) as { type: string; [k: string]: unknown });
  }
}

const tick = (ms = 3) => new Promise((r) => setTimeout(r, ms));

function make(extra: Partial<ConstructorParameters<typeof BridgeClient>[0]> = {}) {
  FakeSocket.all = [];
  const states: string[] = [];
  const client = new BridgeClient({ ws: 'ws://127.0.0.1:7331', token: 'a'.repeat(32), cols: 80, rows: 24, makeSocket: (u) => new FakeSocket(u), backoffMs: [2, 4, 8], giveUpMs: 1000, pingMs: 5, ...extra });
  client.on('state', (s) => states.push(s));
  return { client, states, sock: () => FakeSocket.all[FakeSocket.all.length - 1] };
}

test('auth is the first frame; hello → paired; pairMs measured; input queued while connecting is flushed', async () => {
  const { client, states, sock } = make();
  client.connect();
  assert.equal(client.state, 'connecting');
  client.sendInput('ls\r'); // queued
  sock().open();
  assert.equal(sock().parsed()[0].type, 'auth');
  assert.equal(sock().parsed()[0].cols, 80);
  sock().hello();
  assert.equal(client.state, 'paired');
  assert.ok(typeof client.pairMs === 'number' && client.pairMs >= 0);
  assert.deepEqual(sock().parsed().map((f) => f.type), ['auth', 'input']);
  assert.deepEqual(states, ['connecting', 'paired']);
  client.close();
  assert.equal(client.state, 'closed');
});

test('data/status/exit frames are surfaced; lastStatus kept; ping every pingMs while paired', async () => {
  const { client, sock } = make();
  try {
    const got: string[] = [];
    client.on('data', (d) => got.push(d));
    client.on('exit', (c) => got.push(`exit:${c}`));
    client.connect();
    sock().open();
    sock().hello();
    sock().frame({ type: 'data', data: 'hi' });
    sock().frame({ type: 'status', cwd: '/x', running: false, last_exit_code: 1, last_command_ms: 5, last_command: 'false' });
    sock().frame({ type: 'exit', code: 0 });
    assert.deepEqual(got, ['hi', 'exit:0']);
    assert.equal(client.lastStatus?.last_exit_code, 1);
    await tick(60); // pingMs 5: at least one ping even when the test runner is loaded (no exact-count wall-clock claims)
    assert.ok(sock().parsed().filter((f) => f.type === 'ping').length >= 1);
  } finally {
    client.close(); // an open ping interval would keep the test process alive forever
  }
});

test('busy and unauthorized are terminal; no auto-reconnect', async () => {
  const a = make();
  a.client.connect();
  a.sock().open();
  a.sock().frame({ type: 'error', code: 'busy', message: 'x' });
  a.sock().close(4409, 'busy');
  await tick(20);
  assert.equal(a.client.state, 'busy');
  assert.equal(FakeSocket.all.length, 1);

  const b = make();
  b.client.connect();
  b.sock().open();
  b.sock().close(4401, 'bad token');
  await tick(20);
  assert.equal(b.client.state, 'unauthorized');
  assert.equal(FakeSocket.all.length, 1);
});

test('unexpected close → disconnected → reconnect with backoff 2,4,8,8; reconnect count; give up after giveUpMs', async () => {
  const { client, states, sock } = make({ giveUpMs: 40 });
  client.connect();
  sock().open();
  sock().hello();
  sock().close(1006, '');
  assert.equal(client.state, 'disconnected');
  assert.ok(client.reconnectAt !== null);
  await tick(3); // 2 ms backoff
  assert.equal(FakeSocket.all.length, 2);
  sock().open();
  sock().hello();
  assert.equal(client.state, 'paired');
  assert.equal(client.reconnects, 1);
  // now fail repeatedly until give-up
  for (let i = 0; i < 8; i++) {
    sock().close(1006, '');
    await tick(12);
  }
  assert.equal(client.state, 'disconnected');
  const n = FakeSocket.all.length;
  await tick(30);
  assert.equal(FakeSocket.all.length, n, 'no more sockets after give-up');
  assert.equal(client.reconnectAt, null);
  assert.ok(states.includes('disconnected'));
  client.close();
});

test('regression (Opus/Fable pass 2): input typed during a re-pair is dropped, the ping interval is not doubled, and a hello timeout retries instead of "unauthorized"', async () => {
  const { client, sock } = make();
  try {
    client.connect();
    sock().open();
    sock().hello();
    const firstSock = sock();
    firstSock.close(1006, 'lost');
    assert.equal(client.state, 'disconnected');
    await new Promise((r) => setTimeout(r, 30)); // first backoff (2 ms in the fake) → reconnecting
    assert.equal(client.state, 'connecting');
    client.sendInput('typed-into-the-void\r');
    sock().open();
    sock().hello();
    sock().hello(); // a duplicate hello must not start a second ping loop
    assert.equal(client.state, 'paired');
    assert.deepEqual(sock().parsed().map((f) => f.type), ['auth'], 'queued keystrokes were replayed into the new shell');
    // pingMs 5 over 60 ms → ≤ 12 pings from one loop (+2 slack); a doubled loop gives ~2×. Under
    // load timers only get *fewer*, so the upper bound is the robust assertion.
    await new Promise((r) => setTimeout(r, 60));
    const pings = sock().parsed().filter((f) => f.type === 'ping').length;
    assert.ok(pings >= 1 && pings <= 14, `ping rate doubled: ${pings}`);
  } finally {
    client.close(); // never leave the ping interval alive (it would keep the test process running)
  }
});

test('reconnectNow from busy re-attempts; a hello timeout is a retry (disconnected), never unauthorized', async () => {
  const { client, sock } = make();
  client.connect();
  sock().open();
  sock().frame({ type: 'error', code: 'busy', message: 'x' });
  sock().close(4409, 'busy');
  client.reconnectNow();
  assert.equal(client.state, 'connecting');
  assert.equal(FakeSocket.all.length, 2);
  sock().open();
  sock().close(NO_HELLO_CLOSE_CODE, 'no hello'); // what the auth timer does
  assert.equal(client.state, 'disconnected');
  assert.ok(client.reconnectAt !== null, 'a retry must be scheduled');
  client.close();
});

test('agent relay: agent_call is surfaced; agent_tools / agent_result are sent when paired', () => {
  const { client, sock } = make();
  const calls: unknown[] = [];
  client.on('agent_call', (c) => calls.push(c));
  assert.equal(client.publishAgentTools([]), false);
  client.connect();
  sock().open();
  sock().hello();
  assert.equal(client.publishAgentTools([{ name: 'terminal_status', description: 'd', inputSchema: {} }]), true);
  sock().frame({ type: 'agent_call', call_id: 'c1', tool: 'terminal_status', input: {} });
  assert.deepEqual(calls, [{ call_id: 'c1', tool: 'terminal_status', input: {} }]);
  assert.equal(client.sendAgentResult('c1', { ok: true }), true);
  assert.deepEqual(sock().parsed().map((f) => f.type), ['auth', 'agent_tools', 'agent_result']);
  client.close();
});

test('ledger forward + countersign callback; resize sent only when paired', () => {
  const acks: [number, number, string][] = [];
  const { client, sock } = make({ onCountersign: (c, b, s) => acks.push([c, b, s]) });
  assert.equal(client.forwardLedger({ seq: 1, t: 't', session: 's', kind: 'proposed', fields: {}, prev: '', sig: 'x' }), false);
  client.connect();
  sock().open();
  sock().hello();
  client.resize(100, 30);
  assert.equal(client.forwardLedger({ seq: 1, t: 't', session: 's', kind: 'proposed', fields: {}, prev: '', sig: 'x' }), true);
  sock().frame({ type: 'ledger_ack', seq: 9, sig: 'b'.repeat(64), client_seq: 1 });
  assert.deepEqual(acks, [[1, 9, 'b'.repeat(64)]]);
  assert.deepEqual(sock().parsed().map((f) => f.type), ['auth', 'resize', 'ledger']);
  client.close();
});

test('regression (judge mode, 2026-08-28): an impossible resize is never sent (the bridge would refuse it)', () => {
  const { client, sock } = make();
  try {
    client.connect();
    sock().open();
    sock().hello();
    client.resize(0, 1);
    client.resize(80, 1);
    client.resize(Number.NaN, 24);
    assert.deepEqual(sock().parsed().map((f) => f.type), ['auth']);
    client.resize(100, 30);
    assert.deepEqual(sock().parsed().map((f) => f.type), ['auth', 'resize']);
  } finally {
    client.close();
  }
});
