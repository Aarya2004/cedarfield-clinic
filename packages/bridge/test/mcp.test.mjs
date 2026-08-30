// node --test packages/bridge/test/mcp.test.mjs — real bridge, a fake tab, an MCP client over stdio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { startBridge } from '../src/bridge.js';
import { AgentLink, createMcpServer, toMcpTool } from '../src/mcp.js';
import { deriveAgentToken } from '../src/agent-token.js';
import { TRUST_BOUNDARY, readLedgerRows } from '../src/mcp-resources.js';

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
        { name: 'terminal_status', description: 'status', inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true, untrustedContentHint: true } },
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
  const transport = new StdioClientTransport({ command: process.execPath, args: [bin, 'mcp', '--ws', `ws://127.0.0.1:${port}`, '--token', deriveAgentToken(token)], stderr: 'pipe' });
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
  a.s.send(JSON.stringify({ type: 'auth', token: deriveAgentToken(token), role: 'agent' }));
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
  b.s.send(JSON.stringify({ type: 'auth', token: deriveAgentToken(token), role: 'agent' }));
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
  const link = new AgentLink({ ws: `ws://127.0.0.1:${port}`, token: deriveAgentToken(token), backoffMs: [100, 100] });
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
  const a = new AgentLink({ ws: `ws://127.0.0.1:${port}`, token: deriveAgentToken(token), backoffMs: [50, 50] });
  await a.connect();
  const b = new AgentLink({ ws: `ws://127.0.0.1:${port}`, token: deriveAgentToken(token), backoffMs: [50, 50] });
  await b.connect();
  await new Promise((r) => setTimeout(r, 600)); // long enough for a wrongful reconnect to have happened
  assert.equal(a.socket, null, 'the replaced link must not reconnect');
  assert.ok(b.socket && b.socket.readyState === 1, 'the newer link must keep the slot');
  a.close();
  b.close();
  bridge.close();
});

// ---------- ticket #7: MCP resources + prompts (read surfaces only; nothing here can type) ----------

test('MCP resources/prompts over the real stdio transport: 3 resources, 3 prompts, page relays pass through verbatim', async () => {
  const token = randomBytes(16).toString('hex');
  const port = 21000 + Math.floor(Math.random() * 20000);
  const bridge = await startBridge({ port, token, ledgerDir: mkdtempSync(join(tmpdir(), 'rokan-mcp-res-')), shell: '/bin/zsh' });

  // the "tab": answers terminal_history with an honest {shared:false} refusal, forge_list with one tool
  const tab = new WebSocket(`ws://127.0.0.1:${port}`);
  await new Promise((r) => tab.on('open', r));
  tab.on('message', (m) => {
    const f = JSON.parse(m.toString());
    if (f.type === 'hello') {
      tab.send(JSON.stringify({ type: 'agent_tools', tools: [
        { name: 'terminal_history', description: 'runs', inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true } },
        { name: 'forge_list', description: 'forged', inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true } },
      ] }));
    }
    if (f.type === 'agent_call') {
      const result = f.tool === 'terminal_history'
        ? { shared: false, reason: 'Share screen is off' }
        : { tools: [{ name: 'forged_hn_top', hash: 'abc123def456', kept: true }] };
      tab.send(JSON.stringify({ type: 'agent_result', call_id: f.call_id, result }));
    }
  });
  tab.send(JSON.stringify({ type: 'auth', token, cols: 80, rows: 24 }));
  await new Promise((r) => setTimeout(r, 300));

  const transport = new StdioClientTransport({ command: process.execPath, args: [bin, 'mcp', '--ws', `ws://127.0.0.1:${port}`, '--token', deriveAgentToken(token)], stderr: 'pipe' });
  const client = new Client({ name: 'test', version: '0' });
  await client.connect(transport);

  const res = await client.listResources();
  assert.deepEqual(res.resources.map((r) => r.uri).sort(), ['forge://tools', 'terminal://history', 'terminal://ledger']);
  assert.equal(res.resources.find((r) => r.uri === 'terminal://ledger')?.mimeType, 'application/x-ndjson');
  assert.equal(res.resources.find((r) => r.uri === 'terminal://history')?.mimeType, 'application/json');

  // Share screen off → the page's refusal IS the content; the relay must not invent an error
  const hist = await client.readResource({ uri: 'terminal://history' });
  assert.equal(hist.contents[0].uri, 'terminal://history');
  assert.equal(hist.contents[0].mimeType, 'application/json');
  assert.deepEqual(JSON.parse(hist.contents[0].text), { shared: false, reason: 'Share screen is off' });

  const forged = await client.readResource({ uri: 'forge://tools' });
  assert.deepEqual(JSON.parse(forged.contents[0].text), { tools: [{ name: 'forged_hn_top', hash: 'abc123def456', kept: true }] });

  const prompts = await client.listPrompts();
  assert.deepEqual(prompts.prompts.map((p) => p.name).sort(), ['debug-last-failure', 'forge-from-history', 'session-report']);
  assert.deepEqual(prompts.prompts.find((p) => p.name === 'forge-from-history')?.arguments?.map((a) => a.name), ['n']);

  for (const name of ['debug-last-failure', 'forge-from-history', 'session-report']) {
    const got = await client.getPrompt({ name, arguments: {} });
    assert.equal(got.messages.length, 1);
    assert.equal(got.messages[0].role, 'user');
    const text = got.messages[0].content.text;
    assert.ok(text.includes(TRUST_BOUNDARY), `${name} must state the trust boundary`);
    assert.ok(/terminal_propose|terminal_history|forge_create|terminal:\/\//.test(text), `${name} must name the tools/resources it uses`);
  }

  // the optional n argument is substituted into the template
  const withN = await client.getPrompt({ name: 'forge-from-history', arguments: { n: '7' } });
  assert.match(withN.messages[0].content.text, /last 7 runs/);
  assert.match(withN.messages[0].content.text, /last_n=7/);
  const dflt = await client.getPrompt({ name: 'forge-from-history', arguments: {} });
  assert.match(dflt.messages[0].content.text, /last 20 runs/);

  await client.close();
  tab.close();
  bridge.close();
});

test('terminal://ledger: current session only, raw bytes, capped at 500 with a truncation note', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'rokan-mcp-led-'));
  const file = join(dir, 'ledger.jsonl');
  // hand-written rows with odd spacing + an escape: re-serializing would change these bytes
  const mine1 = '{"seq":1, "session":"sess_mine", "kind":"proposal_created",  "cmd":"echo \\u00e9", "sig":"aa"}';
  const theirs = '{"seq":1,"session":"sess_other","kind":"proposal_created","sig":"bb"}';
  const mine2 = '{"seq":2, "session":"sess_mine", "kind":"executed", "exit_code":0, "sig":"cc"}';
  writeFileSync(file, [mine1, theirs, mine2, ''].join('\n'));

  const out = readLedgerRows(file, 'sess_mine');
  assert.equal(out, mine1 + '\n' + mine2 + '\n', 'rows must be served byte-identical and session-scoped');
  assert.ok(!out.includes('sess_other'), 'another session must never appear');

  // >500 rows → last 500 + a leading comment line
  const many = [];
  for (let i = 1; i <= 620; i++) many.push(`{"seq":${i}, "session":"sess_mine", "kind":"k${i}", "sig":"s${i}"}`);
  const big = join(dir, 'big.jsonl');
  writeFileSync(big, many.join('\n') + '\n');
  const cut = readLedgerRows(big, 'sess_mine');
  const lines = cut.split('\n').filter(Boolean);
  assert.equal(lines.length, 501);
  assert.match(lines[0], /^# truncated: showing the last 500 of 620 rows for session sess_mine$/);
  assert.equal(lines[1], many[120]); // 620 - 500 = first kept is seq 121
  assert.equal(lines[500], many[619]);

  // no session known yet / no file → an honest note, never an invented row
  assert.match(readLedgerRows(file, null), /^# no bridge session yet/);
  assert.match(readLedgerRows(join(dir, 'nope.jsonl'), 'sess_mine'), /^# no ledger file/);
});

test('ReadResource terminal://ledger through a real MCP client, scoped to the session from the bridge hello', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'rokan-mcp-led2-'));
  const file = join(dir, 'ledger.jsonl');
  const row = '{"seq":1, "session":"sess_live", "kind":"executed", "sig":"zz"}';
  writeFileSync(file, row + '\n{"seq":1,"session":"sess_gone","kind":"executed","sig":"yy"}\n');

  // a fake link with the same shape createMcpServer relies on; hello carries the session id
  const link = { tools: [], hello: { session_id: 'sess_live' }, onToolsChanged: () => {}, call: async () => { throw new Error('no tab connected'); } };
  const server = createMcpServer(link, { ledgerFile: file });
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0' });
  await Promise.all([server.connect(serverT), client.connect(clientT)]);

  const led = await client.readResource({ uri: 'terminal://ledger' });
  assert.equal(led.contents[0].mimeType, 'application/x-ndjson');
  assert.equal(led.contents[0].text, row + '\n');

  // no tab → the relay surfaces the link's normal error, same as a tool call today
  await assert.rejects(() => client.readResource({ uri: 'terminal://history' }), /no tab connected/);
  await assert.rejects(() => client.readResource({ uri: 'nope://x' }), /unknown resource/);
  await assert.rejects(() => client.getPrompt({ name: 'nope', arguments: {} }), /unknown prompt/);

  await client.close();
  await server.close();
});

// ---------- P1-3: annotations pass through unchanged, on the wire ----------

test('toMcpTool keeps readOnlyHint / untrustedContentHint / destructiveHint from the page; openWorldHint pinned false', () => {
  const t = toMcpTool({ name: 'terminal_read_screen', description: 'screen', inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true, untrustedContentHint: true } });
  assert.deepEqual(t.annotations, { readOnlyHint: true, untrustedContentHint: true, destructiveHint: false, openWorldHint: false });
  const d = toMcpTool({ name: 'x', description: 'x', annotations: { destructiveHint: true } });
  assert.deepEqual(d.annotations, { readOnlyHint: false, untrustedContentHint: false, destructiveHint: true, openWorldHint: false });
  assert.deepEqual(d.inputSchema, { type: 'object', properties: {} });
  assert.deepEqual(toMcpTool({ name: 'y', description: 'y' }).annotations, { readOnlyHint: false, untrustedContentHint: false, destructiveHint: false, openWorldHint: false });
});

test('tools/list on the wire carries untrustedContentHint (SDK 1.30 client schema strips it on parse, so assert the raw JSON-RPC message)', async () => {
  const link = {
    tools: [{ name: 'terminal_read_screen', description: 'screen', inputSchema: { type: 'object', properties: {} }, annotations: { readOnlyHint: true, untrustedContentHint: true } }],
    hello: { session_id: 's' },
    onToolsChanged: () => {},
    call: async () => { throw new Error('no tab'); },
  };
  const server = createMcpServer(link, { ledgerFile: '/nonexistent' });
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '0' });
  await Promise.all([server.connect(serverT), client.connect(clientT)]);
  const raw = [];
  const orig = clientT.onmessage;
  clientT.onmessage = (m, extra) => { raw.push(m); orig?.(m, extra); };
  const list = await client.listTools();
  assert.equal(list.tools[0].annotations.readOnlyHint, true);
  const wire = raw.find((m) => m.result && Array.isArray(m.result.tools));
  assert.ok(wire, 'tools/list response not captured');
  assert.deepEqual(wire.result.tools[0].annotations, { readOnlyHint: true, untrustedContentHint: true, destructiveHint: false, openWorldHint: false });
  await client.close();
  await server.close();
});
