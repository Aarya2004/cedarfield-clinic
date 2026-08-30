// node --test packages/bridge/test/auth.test.mjs — role by credential, not by declaration (P0-2), on a real bridge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import WebSocket from 'ws';
import { startBridge } from '../src/bridge.js';
import { deriveAgentToken, tokenEquals } from '../src/agent-token.js';
import { readLedgerRows } from '../src/mcp-resources.js';
import { REDACTED } from '../src/redact.js';

const open = (port) => new Promise((resolve, reject) => {
  const s = new WebSocket(`ws://127.0.0.1:${port}`);
  const frames = [];
  const closes = [];
  s.on('message', (m) => frames.push(JSON.parse(m.toString())));
  s.on('close', (code, reason) => closes.push({ code, reason: reason.toString() }));
  s.on('open', () => resolve({ s, frames, closes }));
  s.on('error', reject);
});
const until = (list, pred, ms = 3000) => new Promise((resolve) => {
  const t0 = Date.now();
  const tick = () => {
    const f = list.find(pred);
    if (f) return resolve(f);
    if (Date.now() - t0 > ms) return resolve(null);
    setTimeout(tick, 20);
  };
  tick();
});
const auth = async (port, frame) => {
  const c = await open(port);
  c.s.send(JSON.stringify(frame));
  const hello = await until(c.frames, (f) => f.type === 'hello', 1500);
  const err = hello ? null : await until(c.frames, (f) => f.type === 'error', 1500);
  const closed = hello ? null : await until(c.closes, () => true, 1500);
  return { ...c, hello, err, closed };
};

test('deriveAgentToken is deterministic, one-way, and distinct from the pairing token', () => {
  const t = randomBytes(16).toString('hex');
  const a = deriveAgentToken(t);
  assert.equal(a, deriveAgentToken(t));
  assert.match(a, /^[a-f0-9]{64}$/);
  assert.notEqual(a, t);
  assert.ok(tokenEquals(a, deriveAgentToken(t)));
  assert.ok(!tokenEquals(a, t));
  assert.ok(!tokenEquals(a, a.slice(0, 63)));
});

test('agent token + role agent → accepted as agent; input frames refused; human token + role agent → refused; agent token + no role / role human → refused', async () => {
  const token = randomBytes(16).toString('hex');
  const port = 21000 + Math.floor(Math.random() * 20000);
  const ledgerDir = mkdtempSync(join(tmpdir(), 'rokan-auth-'));
  const bridge = await startBridge({ port, token, ledgerDir, shell: '/bin/zsh' });
  const agentToken = deriveAgentToken(token);
  assert.equal(bridge.agentToken, agentToken, 'the bridge exposes the derived token for current.json');
  try {
    // 1. the mechanism: agent token with role agent
    const a = await auth(port, { type: 'auth', token: agentToken, role: 'agent' });
    assert.equal(a.hello?.role, 'agent', JSON.stringify(a.err));
    a.s.send(JSON.stringify({ type: 'input', data: 'rm -rf /\r' }));
    const refused = await until(a.frames, (f) => f.type === 'error' && /agents may not send input/.test(f.message));
    assert.ok(refused, 'agent input must be refused per isAgentFrameAllowed');
    assert.equal(a.s.readyState, WebSocket.OPEN, 'refusal is a frame, not a disconnect');

    // 2. self-declaration with the human credential is refused
    const h = await auth(port, { type: 'auth', token, role: 'agent' });
    assert.equal(h.hello, null, 'pairing token must not pass as agent');
    assert.equal(h.err?.code, 'unauthorized');
    assert.equal(h.closed?.code, 4401);

    // 3. the agent credential cannot pair a tab (no role, or role human)
    for (const frame of [{ type: 'auth', token: agentToken, cols: 80, rows: 24 }, { type: 'auth', token: agentToken, role: 'human' }]) {
      const r = await auth(port, frame);
      assert.equal(r.hello, null, `agent token must not pair as tab: ${JSON.stringify(frame)}`);
      assert.equal(r.err?.code, 'unauthorized');
      assert.equal(r.closed?.code, 4401);
    }

    // 4. the tab keeps working exactly as before: pairing token, no role (what apps/web sends)
    const tab = await auth(port, { type: 'auth', token, cols: 80, rows: 24 });
    assert.equal(tab.hello?.mode, 'builder');
    assert.equal(tab.hello?.role, undefined);
    const tab2 = await auth(port, { type: 'auth', token, role: 'human' });
    assert.equal(tab2.err?.code, 'busy', 'role human with the pairing token is a tab (second tab → busy)');
    a.s.close();
    tab.s.close();
  } finally {
    bridge.close();
  }
});

test('ledger: an exported AWS secret is redacted BEFORE signing — on disk and on terminal://ledger; `ls` unchanged; file is 0600', async () => {
  const token = randomBytes(16).toString('hex');
  const port = 21000 + Math.floor(Math.random() * 20000);
  const ledgerDir = mkdtempSync(join(tmpdir(), 'rokan-redact-'));
  const bridge = await startBridge({ port, token, ledgerDir, shell: '/bin/zsh' });
  try {
    const tab = await auth(port, { type: 'auth', token, cols: 100, rows: 30 });
    assert.ok(tab.hello);
    const typeCommand = async (cmd, tries = 4) => {
      for (let i = 0; i < tries; i++) {
        tab.s.send(JSON.stringify({ type: 'input', data: '\x15' + cmd + '\r' }));
        const st = await until(tab.frames, (f) => f.type === 'status' && f.last_command === cmd && f.running === false, 6000);
        if (st) return st;
        await new Promise((r) => setTimeout(r, 500));
      }
      return null;
    };
    assert.ok(await typeCommand(':', 6), 'shell did not come up');
    const secretCmd = 'export AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
    assert.ok(await typeCommand(secretCmd), 'secret command did not round-trip');
    assert.ok(await typeCommand('ls'), 'ls did not round-trip');

    const raw = readFileSync(join(ledgerDir, 'ledger.jsonl'), 'utf8');
    assert.ok(!raw.includes('wJalrXUtnFEMI'), 'the secret must never reach disk');
    const rows = raw.trim().split('\n').map((l) => JSON.parse(l)).filter((r) => r.kind === 'executed');
    const secretRow = rows.find((r) => r.command.startsWith('export AWS_SECRET_ACCESS_KEY'));
    assert.equal(secretRow?.command, `export AWS_SECRET_ACCESS_KEY=${REDACTED}`);
    assert.ok(rows.some((r) => r.command === 'ls'), 'a plain ls lands verbatim');

    // the MCP resource serves the same bytes — redacted at write time, so signed bytes == served bytes
    const served = readLedgerRows(join(ledgerDir, 'ledger.jsonl'), bridge.sessionId);
    assert.ok(!served.includes('wJalrXUtnFEMI'));
    assert.ok(served.includes(`export AWS_SECRET_ACCESS_KEY=${REDACTED}`));
    assert.equal((statSync(join(ledgerDir, 'ledger.jsonl')).mode & 0o777), 0o600);
    tab.s.close();
  } finally {
    bridge.close();
  }
});
