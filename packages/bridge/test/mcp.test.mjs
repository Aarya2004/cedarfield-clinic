// node --test packages/bridge/test/mcp.test.mjs — real bridge, a fake tab, an MCP client over stdio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { startBridge } from '../src/bridge.js';
import { AgentLink } from '../src/mcp.js';

const bin = fileURLToPath(new URL('../bin/rokan-terminal.js', import.meta.url));

test('MCP parity: tools published by the tab are listed over stdio; a call is relayed to the tab and answered', async () => {
  const token = randomBytes(16).toString('hex');
  const port = 21000 + Math.floor(Math.random() * 20000);
  const bridge = await startBridge({ port, token, ledgerDir: mkdtempSync(join(tmpdir(), 'rokan-mcp-')), shell: '/bin/zsh' });

  // the "tab": pairs as human, publishes two tools, answers calls
  const tab = new WebSocket(`ws://127.0.0.1:${port}`);
  const calls = [];
  await new Promise((r) => tab.on('open', r));
  tab.on('message', (m) => {
    const f = JSON.parse(m.toString());
    if (f.type === 'hello') {
      tab.send(JSON.stringify({ type: 'agent_tools', tools: [
        { name: 'terminal_status', description: 'status', inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true } },
        { name: 'forged_hn_top', description: 'CONSEQUENTIAL: top n', inputSchema: { type: 'object', properties: { n: { type: 'string' } }, required: ['n'] }, annotations: { readOnlyHint: false } },
      ] }));
    }
    if (f.type === 'agent_call') {
      calls.push(f);
      tab.send(JSON.stringify({ type: 'agent_result', call_id: f.call_id, result: { echoed: f.tool, input: f.input, proposal_id: 'p_relayed' } }));
    }
  });
  tab.send(JSON.stringify({ type: 'auth', token, cols: 80, rows: 24 }));
  await new Promise((r) => setTimeout(r, 300));

  // the MCP client spawns `rokan-terminal mcp` (stdio) which connects to the bridge as an agent
  const transport = new StdioClientTransport({ command: process.execPath, args: [bin, 'mcp', '--ws', `ws://127.0.0.1:${port}`, '--token', token], stderr: 'pipe' });
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(transport);
  const list = await client.listTools();
  assert.deepEqual(list.tools.map((t) => t.name).sort(), ['forged_hn_top', 'terminal_status']);
  assert.equal(list.tools.find((t) => t.name === 'terminal_status')?.annotations?.readOnlyHint, true);
  assert.equal(list.tools.find((t) => t.name === 'forged_hn_top')?.annotations?.readOnlyHint, false);

  const r = await client.callTool({ name: 'forged_hn_top', arguments: { n: '3' } });
  assert.equal(r.isError, false);
  const parsed = JSON.parse(r.content[0].text);
  assert.equal(parsed.echoed, 'forged_hn_top');
  assert.deepEqual(parsed.input, { n: '3' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].tool, 'forged_hn_top');

  // tool list change → notification → the client sees the new list
  tab.send(JSON.stringify({ type: 'agent_tools', tools: [{ name: 'terminal_status', description: 'status', inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true } }] }));
  await new Promise((r) => setTimeout(r, 300));
  const list2 = await client.listTools();
  assert.deepEqual(list2.tools.map((t) => t.name), ['terminal_status']);

  // an agent may not send PTY input: the bridge refuses the frame without dropping the socket
  await client.close();
  tab.close();
  bridge.close();
});

test('agent role: input frames are refused; a second agent process takes over (the first is told replaced); the tab absent → error result', async () => {
  const token = randomBytes(16).toString('hex');
  const port = 21000 + Math.floor(Math.random() * 20000);
  const bridge = await startBridge({ port, token, ledgerDir: mkdtempSync(join(tmpdir(), 'rokan-mcp2-')), shell: '/bin/zsh' });
  const open = () => new Promise((resolve) => {
    const s = new WebSocket(`ws://127.0.0.1:${port}`);
    const frames = [];
    s.on('message', (m) => frames.push(JSON.parse(m.toString())));
    s.on('open', () => resolve({ s, frames }));
  });
  const until = (frames, pred, ms = 3000) => new Promise((resolve) => {
    const t0 = Date.now();
    const tick = () => {
      const f = frames.find(pred);
      if (f) return resolve(f);
      if (Date.now() - t0 > ms) return resolve(null);
      setTimeout(tick, 20);
    };
    tick();
  });
  const a = await open();
  a.s.send(JSON.stringify({ type: 'auth', token, role: 'agent' }));
  const hello = await until(a.frames, (f) => f.type === 'hello');
  assert.equal(hello?.role, 'agent');
  assert.equal(hello?.tab_connected, false);
  a.s.send(JSON.stringify({ type: 'input', data: 'rm -rf /\r' }));
  const refused = await until(a.frames, (f) => f.type === 'error' && /agents may not send input/.test(f.message));
  assert.ok(refused);
  a.s.send(JSON.stringify({ type: 'agent_call', call_id: 'x1', tool: 'terminal_status', input: {} }));
  const noTab = await until(a.frames, (f) => f.type === 'agent_result' && f.call_id === 'x1');
  assert.match(noTab?.error ?? '', /no tab/);
  const b = await open();
  b.s.send(JSON.stringify({ type: 'auth', token, role: 'agent' }));
  // newest agent process wins; the first is told `replaced` (Codex CLI needs a new session to see forged tools)
  const helloB = await until(b.frames, (f) => f.type === 'hello');
  assert.ok(helloB, 'second agent must be accepted');
  const replaced = await until(a.frames, (f) => f.type === 'error' && f.code === 'replaced', 2000);
  assert.ok(replaced, 'first agent must be told replaced');
  a.s.close();
  b.s.close();
  bridge.close();
});

test('regression (Opus/Fable pass 2 P2): AgentLink reconnects after a bridge restart and gets the tool list back', async () => {
  const token = randomBytes(16).toString('hex');
  const port = 21000 + Math.floor(Math.random() * 20000);
  const ledgerDir = mkdtempSync(join(tmpdir(), 'rokan-mcp-rc-'));
  let bridge = await startBridge({ port, token, ledgerDir, shell: '/bin/zsh' });
  const link = new AgentLink({ ws: `ws://127.0.0.1:${port}`, token, backoffMs: [100, 100] });
  const lists = [];
  link.onToolsChanged = (t) => lists.push(t.map((x) => x.name));
  await link.connect();
  const publishOn = (sock) => {
    sock.on('message', (m) => {
      const f = JSON.parse(m.toString());
      if (f.type === 'hello') sock.send(JSON.stringify({ type: 'agent_tools', tools: [{ name: 'terminal_status', description: 's', inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true } }] }));
    });
    sock.send(JSON.stringify({ type: 'auth', token, cols: 80, rows: 24 }));
  };
  const tab = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise((r) => tab.on('open', r));
  publishOn(tab);
  await new Promise((r) => setTimeout(r, 300));
  assert.deepEqual(link.tools.map((t) => t.name), ['terminal_status']);

  bridge.close(); // bridge goes away → list emptied, reconnect loop running
  // Observable state only: `link.socket` flips between null and a fresh connecting socket every
  // backoff tick (racy to snapshot — failed on Linux CI), so poll for the emptied list instead.
  for (let i = 0; i < 50 && link.tools.length; i++) await new Promise((r) => setTimeout(r, 100));
  assert.deepEqual(link.tools, []);
  assert.ok(lists.some((l) => l.length === 0), 'clients were never told the list emptied');
  await assert.rejects(() => link.call('terminal_status', {}), /not connected|disconnected/);

  bridge = await startBridge({ port, token, ledgerDir, shell: '/bin/zsh' });
  for (let i = 0; i < 40 && !(link.socket && link.socket.readyState === 1); i++) await new Promise((r) => setTimeout(r, 100));
  assert.ok(link.socket && link.socket.readyState === 1, 'did not reconnect');
  assert.ok(link.reconnects >= 1);
  const tab2 = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise((r) => tab2.on('open', r));
  publishOn(tab2);
  await new Promise((r) => setTimeout(r, 300));
  assert.deepEqual(link.tools.map((t) => t.name), ['terminal_status']);
  link.close();
  tab2.close();
  bridge.close();
});

test('regression (Codex sessions, 2026-08-29): a replaced AgentLink stands down; the newer process keeps the slot', async () => {
  const token = randomBytes(16).toString('hex');
  const port = 21000 + Math.floor(Math.random() * 20000);
  const bridge = await startBridge({ port, token, ledgerDir: mkdtempSync(join(tmpdir(), 'rokan-mcp-rp-')), shell: '/bin/zsh' });
  const a = new AgentLink({ ws: `ws://127.0.0.1:${port}`, token, backoffMs: [50, 50] });
  await a.connect();
  const b = new AgentLink({ ws: `ws://127.0.0.1:${port}`, token, backoffMs: [50, 50] });
  await b.connect();
  await new Promise((r) => setTimeout(r, 600)); // long enough for a wrongful reconnect to have happened
  assert.equal(a.socket, null, 'the replaced link must not reconnect');
  assert.ok(b.socket && b.socket.readyState === 1, 'the newer link must keep the slot');
  a.close();
  b.close();
  bridge.close();
});
